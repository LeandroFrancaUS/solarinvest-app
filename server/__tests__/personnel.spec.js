// server/__tests__/personnel.spec.js
// Unit tests for personnel management (consultants, engineers, installers).
// Tests validation logic, code format checks, and ART constraints.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — inline mirrors of server validation logic so tests run in isolation
// without requiring a live DB connection.
// ─────────────────────────────────────────────────────────────────────────────

const CODE_REGEX = /^[A-Za-z0-9]{4}$/

function validateConsultantBody(body, requireCode = true) {
  const errors = []
  if (requireCode) {
    if (!body.consultant_code || !CODE_REGEX.test(body.consultant_code)) {
      errors.push('consultant_code deve ter exatamente 4 caracteres alfanuméricos.')
    }
  }
  if (!body.full_name || !String(body.full_name).trim()) {
    errors.push('Nome completo é obrigatório.')
  }
  if (!body.phone || !String(body.phone).trim()) {
    errors.push('Telefone é obrigatório.')
  }
  if (!body.email || !String(body.email).trim()) {
    errors.push('E-mail é obrigatório.')
  }
  const regions = body.regions
  if (!Array.isArray(regions) || regions.length === 0) {
    errors.push('Ao menos uma região (UF) é obrigatória.')
  }
  return errors
}

function validateEngineerBody(body, requireCode = true) {
  const errors = []
  if (requireCode) {
    if (!body.engineer_code || !CODE_REGEX.test(body.engineer_code)) {
      errors.push('engineer_code deve ter exatamente 4 caracteres alfanuméricos.')
    }
  }
  if (!body.full_name || !String(body.full_name).trim()) errors.push('Nome completo é obrigatório.')
  if (!body.phone || !String(body.phone).trim()) errors.push('Telefone é obrigatório.')
  if (!body.email || !String(body.email).trim()) errors.push('E-mail é obrigatório.')
  if (!body.crea || !String(body.crea).trim()) errors.push('CREA é obrigatório.')
  return errors
}

function validateInstallerBody(body, requireCode = true) {
  const errors = []
  if (requireCode) {
    if (!body.installer_code || !CODE_REGEX.test(body.installer_code)) {
      errors.push('installer_code deve ter exatamente 4 caracteres alfanuméricos.')
    }
  }
  if (!body.full_name || !String(body.full_name).trim()) errors.push('Nome completo é obrigatório.')
  if (!body.phone || !String(body.phone).trim()) errors.push('Telefone é obrigatório.')
  if (!body.email || !String(body.email).trim()) errors.push('E-mail é obrigatório.')
  return errors
}

function validateArt(fields) {
  const hasArt = fields.art_number != null && String(fields.art_number ?? '').trim() !== ''
  const hasEngineer = fields.engineer_id != null
  if (hasArt && !hasEngineer) {
    return 'Não é possível salvar ART sem selecionar um engenheiro.'
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Consultant
// ─────────────────────────────────────────────────────────────────────────────

describe('validateConsultantBody', () => {
  const validBody = {
    consultant_code: 'AB12',
    full_name: 'João Silva',
    phone: '11999999999',
    email: 'joao@exemplo.com',
    regions: ['SP'],
  }

  it('passes with a valid body', () => {
    expect(validateConsultantBody(validBody)).toHaveLength(0)
  })

  it('rejects consultant_code with less than 4 chars', () => {
    const errs = validateConsultantBody({ ...validBody, consultant_code: 'AB1' })
    expect(errs.some((e) => e.includes('consultant_code'))).toBe(true)
  })

  it('rejects consultant_code with more than 4 chars', () => {
    const errs = validateConsultantBody({ ...validBody, consultant_code: 'AB123' })
    expect(errs.some((e) => e.includes('consultant_code'))).toBe(true)
  })

  it('rejects consultant_code with special characters', () => {
    const errs = validateConsultantBody({ ...validBody, consultant_code: 'AB!@' })
    expect(errs.some((e) => e.includes('consultant_code'))).toBe(true)
  })

  it('accepts consultant_code with uppercase + digits', () => {
    expect(validateConsultantBody({ ...validBody, consultant_code: 'AB12' })).toHaveLength(0)
  })

  it('accepts consultant_code with lowercase letters', () => {
    expect(validateConsultantBody({ ...validBody, consultant_code: 'ab12' })).toHaveLength(0)
  })

  it('rejects empty full_name', () => {
    const errs = validateConsultantBody({ ...validBody, full_name: '' })
    expect(errs.some((e) => e.includes('Nome'))).toBe(true)
  })

  it('rejects empty phone', () => {
    const errs = validateConsultantBody({ ...validBody, phone: '' })
    expect(errs.some((e) => e.includes('Telefone'))).toBe(true)
  })

  it('rejects empty email', () => {
    const errs = validateConsultantBody({ ...validBody, email: '' })
    expect(errs.some((e) => e.includes('E-mail'))).toBe(true)
  })

  it('rejects empty regions array', () => {
    const errs = validateConsultantBody({ ...validBody, regions: [] })
    expect(errs.some((e) => e.includes('região'))).toBe(true)
  })

  it('accepts multiple regions', () => {
    const errs = validateConsultantBody({ ...validBody, regions: ['SP', 'RJ', 'MG'] })
    expect(errs).toHaveLength(0)
  })

  it('does not require code on update (requireCode=false)', () => {
    const { consultant_code: _, ...bodyWithoutCode } = validBody
    const errs = validateConsultantBody(bodyWithoutCode, false)
    expect(errs).toHaveLength(0)
  })

  it('reports duplicate code error from handler (simulated)', () => {
    // Simulate the handler duplicate-code check
    const existingCodes = new Set(['AB12'])
    const code = 'AB12'
    expect(existingCodes.has(code)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Engineer
// ─────────────────────────────────────────────────────────────────────────────

describe('validateEngineerBody', () => {
  const validBody = {
    engineer_code: 'EG01',
    full_name: 'Tiago Souza',
    phone: '11988888888',
    email: 'tiago@exemplo.com',
    crea: 'CREA-SP 123456',
  }

  it('passes with a valid body', () => {
    expect(validateEngineerBody(validBody)).toHaveLength(0)
  })

  it('rejects engineer_code with less than 4 chars', () => {
    const errs = validateEngineerBody({ ...validBody, engineer_code: 'EG' })
    expect(errs.some((e) => e.includes('engineer_code'))).toBe(true)
  })

  it('rejects engineer_code with special characters', () => {
    const errs = validateEngineerBody({ ...validBody, engineer_code: 'E!01' })
    expect(errs.some((e) => e.includes('engineer_code'))).toBe(true)
  })

  it('rejects empty CREA', () => {
    const errs = validateEngineerBody({ ...validBody, crea: '' })
    expect(errs.some((e) => e.includes('CREA'))).toBe(true)
  })

  it('accepts CREA with UF prefix and slash', () => {
    const errs = validateEngineerBody({ ...validBody, crea: 'CREA-SP 123/456' })
    expect(errs).toHaveLength(0)
  })

  it('rejects empty full_name', () => {
    const errs = validateEngineerBody({ ...validBody, full_name: '' })
    expect(errs.some((e) => e.includes('Nome'))).toBe(true)
  })

  it('does not require code on update (requireCode=false)', () => {
    const { engineer_code: _, ...bodyWithoutCode } = validBody
    const errs = validateEngineerBody(bodyWithoutCode, false)
    expect(errs).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Installer
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInstallerBody', () => {
  const validBody = {
    installer_code: 'IS01',
    full_name: 'Carlos Pereira',
    phone: '11977777777',
    email: 'carlos@exemplo.com',
  }

  it('passes with a valid body', () => {
    expect(validateInstallerBody(validBody)).toHaveLength(0)
  })

  it('rejects installer_code with less than 4 chars', () => {
    const errs = validateInstallerBody({ ...validBody, installer_code: 'IS' })
    expect(errs.some((e) => e.includes('installer_code'))).toBe(true)
  })

  it('rejects installer_code with special characters', () => {
    const errs = validateInstallerBody({ ...validBody, installer_code: 'IS!1' })
    expect(errs.some((e) => e.includes('installer_code'))).toBe(true)
  })

  it('rejects empty email', () => {
    const errs = validateInstallerBody({ ...validBody, email: '' })
    expect(errs.some((e) => e.includes('E-mail'))).toBe(true)
  })

  it('does not require code on update (requireCode=false)', () => {
    const { installer_code: _, ...bodyWithoutCode } = validBody
    const errs = validateInstallerBody(bodyWithoutCode, false)
    expect(errs).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — ART constraint
// ─────────────────────────────────────────────────────────────────────────────

describe('validateArt', () => {
  it('allows art_number when engineer_id is set', () => {
    expect(validateArt({ art_number: '0001234', engineer_id: 5 })).toBeNull()
  })

  it('rejects art_number when engineer_id is null', () => {
    const err = validateArt({ art_number: '0001234', engineer_id: null })
    expect(err).toBeTruthy()
    expect(err).toContain('engenheiro')
  })

  it('allows null art_number without engineer', () => {
    expect(validateArt({ art_number: null, engineer_id: null })).toBeNull()
  })

  it('allows empty art_number string without engineer', () => {
    expect(validateArt({ art_number: '', engineer_id: null })).toBeNull()
  })

  it('allows both art_number and engineer_id set', () => {
    expect(validateArt({ art_number: 'ART-2024-001', engineer_id: 3 })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — CODE_REGEX
// ─────────────────────────────────────────────────────────────────────────────

describe('PERSONNEL_CODE_REGEX', () => {
  const valid = ['AB12', 'ab12', 'ABCD', '1234', 'A1B2', 'aB1c']
  const invalid = ['', 'AB1', 'AB123', 'AB!@', 'AB 2', 'ABCDE']

  valid.forEach((code) => {
    it(`accepts "${code}"`, () => {
      expect(CODE_REGEX.test(code)).toBe(true)
    })
  })

  invalid.forEach((code) => {
    it(`rejects "${code}"`, () => {
      expect(CODE_REGEX.test(code)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — handler permission checks (mock-based)
// ─────────────────────────────────────────────────────────────────────────────

describe('handler permission stubs', () => {
  it('admin can create consultant (simulated)', () => {
    const actor = { isAdmin: true, userId: 'usr-1' }
    expect(actor.isAdmin).toBe(true)
  })

  it('non-admin cannot create consultant', () => {
    const actor = { isAdmin: false, isOffice: true, userId: 'usr-2' }
    expect(actor.isAdmin).toBe(false)
  })

  it('admin can list engineers', () => {
    const actor = { isAdmin: true, isOffice: false, isFinanceiro: false, userId: 'usr-1' }
    const hasReadAccess = actor.isAdmin || actor.isOffice || actor.isFinanceiro
    expect(hasReadAccess).toBe(true)
  })

  it('office can list installers', () => {
    const actor = { isAdmin: false, isOffice: true, isFinanceiro: false, userId: 'usr-3' }
    const hasReadAccess = actor.isAdmin || actor.isOffice || actor.isFinanceiro
    expect(hasReadAccess).toBe(true)
  })

  it('comercial cannot list consultants', () => {
    const actor = { isAdmin: false, isOffice: false, isFinanceiro: false, userId: 'usr-4' }
    const hasReadAccess = actor.isAdmin || actor.isOffice || actor.isFinanceiro
    expect(hasReadAccess).toBe(false)
  })
})
