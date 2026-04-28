// server/__tests__/permissionMap.spec.js
// Unit tests for the central RBAC permission map.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import {
  ROLES,
  PERMISSION_MAP,
  actorDomainRole,
  hasPermission,
  requirePermission,
} from '../auth/permissionMap.js'

// ─── Helper: build actor objects ─────────────────────────────────────────────

function makeActor(overrides = {}) {
  return {
    userId: 'test-user',
    isAdmin:      false,
    isOffice:     false,
    isFinanceiro: false,
    isComercial:  false,
    isOperacao:   false,
    isSuporte:    false,
    hasAnyRole:   false,
    ...overrides,
  }
}

const adminActor      = makeActor({ isAdmin: true, hasAnyRole: true })
const direitoriaActor = makeActor({ isOffice: true, hasAnyRole: true })
const financeiroActor = makeActor({ isFinanceiro: true, hasAnyRole: true })
const comercialActor  = makeActor({ isComercial: true, hasAnyRole: true })
const operacaoActor   = makeActor({ isOperacao: true, hasAnyRole: true })
const suporteActor    = makeActor({ isSuporte: true, hasAnyRole: true })
const noRoleActor     = makeActor({ hasAnyRole: false })

// ─── actorDomainRole ──────────────────────────────────────────────────────────

describe('actorDomainRole', () => {
  it('returns ADMIN for admin actor', () => {
    expect(actorDomainRole(adminActor)).toBe(ROLES.ADMIN)
  })

  it('returns DIRETORIA for isOffice actor', () => {
    expect(actorDomainRole(direitoriaActor)).toBe(ROLES.DIRETORIA)
  })

  it('returns FINANCEIRO for isFinanceiro actor', () => {
    expect(actorDomainRole(financeiroActor)).toBe(ROLES.FINANCEIRO)
  })

  it('returns COMERCIAL for isComercial actor', () => {
    expect(actorDomainRole(comercialActor)).toBe(ROLES.COMERCIAL)
  })

  it('returns OPERACAO for isOperacao actor', () => {
    expect(actorDomainRole(operacaoActor)).toBe(ROLES.OPERACAO)
  })

  it('returns SUPORTE for isSuporte actor', () => {
    expect(actorDomainRole(suporteActor)).toBe(ROLES.SUPORTE)
  })

  it('returns ADMIN as fallback when no role flags are set (backward compat)', () => {
    expect(actorDomainRole(noRoleActor)).toBe(ROLES.ADMIN)
  })

  it('returns null for null actor', () => {
    expect(actorDomainRole(null)).toBeNull()
  })

  it('admin wins when multiple flags are set', () => {
    const multi = makeActor({ isAdmin: true, isOffice: true, isFinanceiro: true })
    expect(actorDomainRole(multi)).toBe(ROLES.ADMIN)
  })

  it('DIRETORIA wins over FINANCEIRO when isOffice + isFinanceiro', () => {
    const multi = makeActor({ isOffice: true, isFinanceiro: true })
    expect(actorDomainRole(multi)).toBe(ROLES.DIRETORIA)
  })
})

// ─── PERMISSION_MAP structure ─────────────────────────────────────────────────

describe('PERMISSION_MAP shape', () => {
  const expectedAreas = ['dashboard', 'comercial', 'clientes', 'cobrancas', 'operacao', 'indicadores', 'relatorios', 'configuracoes']

  it('defines all required areas', () => {
    expectedAreas.forEach((area) => {
      expect(PERMISSION_MAP[area], `area "${area}" should exist`).toBeDefined()
    })
  })

  it('each area has read and write arrays', () => {
    expectedAreas.forEach((area) => {
      expect(Array.isArray(PERMISSION_MAP[area].read), `${area}.read should be array`).toBe(true)
      expect(Array.isArray(PERMISSION_MAP[area].write), `${area}.write should be array`).toBe(true)
    })
  })

  it('ADMIN is in every area read list', () => {
    expectedAreas.forEach((area) => {
      expect(PERMISSION_MAP[area].read, `ADMIN should be in ${area}.read`).toContain(ROLES.ADMIN)
    })
  })

  it('ADMIN is in every area write list', () => {
    expectedAreas.forEach((area) => {
      expect(PERMISSION_MAP[area].write, `ADMIN should be in ${area}.write`).toContain(ROLES.ADMIN)
    })
  })
})

// ─── hasPermission — cobrancas ────────────────────────────────────────────────

describe('hasPermission — cobrancas', () => {
  it('ADMIN can read cobrancas', () => {
    expect(hasPermission(adminActor, 'cobrancas:read')).toBe(true)
  })

  it('ADMIN can write cobrancas', () => {
    expect(hasPermission(adminActor, 'cobrancas:write')).toBe(true)
  })

  it('DIRETORIA can read cobrancas', () => {
    expect(hasPermission(direitoriaActor, 'cobrancas:read')).toBe(true)
  })

  it('DIRETORIA cannot write cobrancas', () => {
    expect(hasPermission(direitoriaActor, 'cobrancas:write')).toBe(false)
  })

  it('FINANCEIRO can read cobrancas', () => {
    expect(hasPermission(financeiroActor, 'cobrancas:read')).toBe(true)
  })

  it('FINANCEIRO can write cobrancas', () => {
    expect(hasPermission(financeiroActor, 'cobrancas:write')).toBe(true)
  })

  it('COMERCIAL cannot read cobrancas → 403 territory', () => {
    expect(hasPermission(comercialActor, 'cobrancas:read')).toBe(false)
  })

  it('OPERACAO cannot read cobrancas', () => {
    expect(hasPermission(operacaoActor, 'cobrancas:read')).toBe(false)
  })

  it('SUPORTE cannot read cobrancas', () => {
    expect(hasPermission(suporteActor, 'cobrancas:read')).toBe(false)
  })
})

// ─── hasPermission — operacao ─────────────────────────────────────────────────

describe('hasPermission — operacao', () => {
  it('ADMIN can read operacao', () => {
    expect(hasPermission(adminActor, 'operacao:read')).toBe(true)
  })

  it('ADMIN can write operacao', () => {
    expect(hasPermission(adminActor, 'operacao:write')).toBe(true)
  })

  it('OPERACAO can read operacao', () => {
    expect(hasPermission(operacaoActor, 'operacao:read')).toBe(true)
  })

  it('OPERACAO can write operacao', () => {
    expect(hasPermission(operacaoActor, 'operacao:write')).toBe(true)
  })

  it('SUPORTE can read operacao', () => {
    expect(hasPermission(suporteActor, 'operacao:read')).toBe(true)
  })

  it('SUPORTE cannot write operacao → 403 territory', () => {
    expect(hasPermission(suporteActor, 'operacao:write')).toBe(false)
  })

  it('FINANCEIRO cannot read operacao', () => {
    expect(hasPermission(financeiroActor, 'operacao:read')).toBe(false)
  })

  it('COMERCIAL cannot read operacao', () => {
    expect(hasPermission(comercialActor, 'operacao:read')).toBe(false)
  })

  it('DIRETORIA cannot read operacao via permissionMap', () => {
    // DIRETORIA (role_office) maps to its own indicadores/dashboard perms,
    // not operacao — operational domain is for operational roles
    expect(hasPermission(direitoriaActor, 'operacao:read')).toBe(false)
  })
})

// ─── hasPermission — comercial ────────────────────────────────────────────────

describe('hasPermission — comercial', () => {
  it('ADMIN can read comercial', () => {
    expect(hasPermission(adminActor, 'comercial:read')).toBe(true)
  })

  it('ADMIN can write comercial', () => {
    expect(hasPermission(adminActor, 'comercial:write')).toBe(true)
  })

  it('COMERCIAL can read comercial', () => {
    expect(hasPermission(comercialActor, 'comercial:read')).toBe(true)
  })

  it('COMERCIAL can write comercial', () => {
    expect(hasPermission(comercialActor, 'comercial:write')).toBe(true)
  })

  it('FINANCEIRO cannot read comercial', () => {
    expect(hasPermission(financeiroActor, 'comercial:read')).toBe(false)
  })

  it('OPERACAO cannot write comercial', () => {
    expect(hasPermission(operacaoActor, 'comercial:write')).toBe(false)
  })
})

// ─── hasPermission — indicadores ─────────────────────────────────────────────

describe('hasPermission — indicadores', () => {
  it('ADMIN can read indicadores', () => {
    expect(hasPermission(adminActor, 'indicadores:read')).toBe(true)
  })

  it('DIRETORIA can read indicadores', () => {
    expect(hasPermission(direitoriaActor, 'indicadores:read')).toBe(true)
  })

  it('FINANCEIRO cannot read indicadores', () => {
    expect(hasPermission(financeiroActor, 'indicadores:read')).toBe(false)
  })

  it('OPERACAO cannot read indicadores', () => {
    expect(hasPermission(operacaoActor, 'indicadores:read')).toBe(false)
  })

  it('COMERCIAL cannot read indicadores', () => {
    expect(hasPermission(comercialActor, 'indicadores:read')).toBe(false)
  })
})

// ─── hasPermission — clientes ─────────────────────────────────────────────────

describe('hasPermission — clientes', () => {
  it('ADMIN can read clientes', () => {
    expect(hasPermission(adminActor, 'clientes:read')).toBe(true)
  })

  it('DIRETORIA can read clientes', () => {
    expect(hasPermission(direitoriaActor, 'clientes:read')).toBe(true)
  })

  it('FINANCEIRO can read clientes', () => {
    expect(hasPermission(financeiroActor, 'clientes:read')).toBe(true)
  })

  it('OPERACAO can read clientes', () => {
    expect(hasPermission(operacaoActor, 'clientes:read')).toBe(true)
  })

  it('COMERCIAL cannot read clientes via permissionMap', () => {
    expect(hasPermission(comercialActor, 'clientes:read')).toBe(false)
  })

  it('SUPORTE cannot read clientes', () => {
    expect(hasPermission(suporteActor, 'clientes:read')).toBe(false)
  })
})

// ─── hasPermission — fallback ADMIN ──────────────────────────────────────────

describe('hasPermission — fallback ADMIN (backward compat)', () => {
  it('actor with no role flags gets ADMIN domain role → can read all areas', () => {
    const areas = ['dashboard', 'comercial', 'clientes', 'cobrancas', 'indicadores', 'relatorios']
    areas.forEach((area) => {
      expect(hasPermission(noRoleActor, `${area}:read`), `no-role actor should read ${area}`).toBe(true)
    })
  })

  it('actor with no role flags → can write all areas', () => {
    const areas = ['cobrancas', 'operacao', 'indicadores', 'configuracoes']
    areas.forEach((area) => {
      expect(hasPermission(noRoleActor, `${area}:write`), `no-role actor should write ${area}`).toBe(true)
    })
  })
})

// ─── hasPermission — edge cases ───────────────────────────────────────────────

describe('hasPermission — edge cases', () => {
  it('returns false for null actor', () => {
    expect(hasPermission(null, 'cobrancas:read')).toBe(false)
  })

  it('returns false for unknown area', () => {
    expect(hasPermission(adminActor, 'unknown_area:read')).toBe(false)
  })

  it('returns false for unknown action', () => {
    expect(hasPermission(adminActor, 'cobrancas:delete')).toBe(false)
  })

  it('returns false for malformed permission (no colon)', () => {
    expect(hasPermission(adminActor, 'cobrancas')).toBe(false)
  })

  it('returns false for empty permission string', () => {
    expect(hasPermission(adminActor, '')).toBe(false)
  })
})

// ─── requirePermission — factory ─────────────────────────────────────────────

describe('requirePermission', () => {
  it('returns a function', () => {
    expect(typeof requirePermission('cobrancas:read')).toBe('function')
  })

  it('returned guard function is async', () => {
    const guard = requirePermission('cobrancas:read')
    // Check it returns a Promise when called
    // We mock resolveActor via a fake req object; resolveActor will return null (no auth).
    const result = guard({ headers: {} })
    expect(result).toBeInstanceOf(Promise)
    // Swallow the expected 401 rejection
    return result.catch(() => {})
  })

  it('throws 401 when resolveActor returns null (unauthenticated)', async () => {
    // resolveActor returns null for requests without valid Stack Auth headers
    // and when STACK_AUTH_BYPASS is false. In the test environment bypass is OFF.
    // We simulate this by passing an empty request object.
    const guard = requirePermission('cobrancas:read')
    await expect(guard({ headers: {} })).rejects.toMatchObject({ statusCode: 401 })
  })
})
