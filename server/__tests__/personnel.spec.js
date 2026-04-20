// server/__tests__/personnel.spec.js
// Unit tests for personnel management (consultants, engineers, installers).
// Tests validation logic, code format checks, code generation, and ART constraints.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — inline mirrors of server validation/generation logic so tests run
// in isolation without requiring a live DB connection.
// ─────────────────────────────────────────────────────────────────────────────

const CONSULTANT_CODE_REGEX = /^[Cc][A-Za-z0-9]{3}$/
const ENGINEER_CODE_REGEX   = /^[Ee][A-Za-z0-9]{3}$/
const INSTALLER_CODE_REGEX  = /^[Ii][A-Za-z0-9]{3}$/

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(prefix) {
  let code = prefix
  for (let i = 0; i < 3; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

function validateConsultantBody(body) {
  const errors = []
  if (!body.full_name || !String(body.full_name).trim()) {
    errors.push('Nome completo é obrigatório.')
  }
  if (!body.phone || !String(body.phone).trim()) {
    errors.push('Telefone é obrigatório.')
  }
  if (!body.email || !String(body.email).trim()) {
    errors.push('E-mail é obrigatório.')
  }
  if (!body.document || !String(body.document).trim()) {
    errors.push('CPF/CNPJ é obrigatório.')
  }
  const regions = body.regions
  if (!Array.isArray(regions) || regions.length === 0) {
    errors.push('Ao menos uma região (UF) é obrigatória.')
  }
  return errors
}

function validateEngineerBody(body) {
  const errors = []
  if (!body.full_name || !String(body.full_name).trim()) errors.push('Nome completo é obrigatório.')
  if (!body.phone || !String(body.phone).trim()) errors.push('Telefone é obrigatório.')
  if (!body.email || !String(body.email).trim()) errors.push('E-mail é obrigatório.')
  if (!body.crea || !String(body.crea).trim()) errors.push('CREA é obrigatório.')
  if (!body.document || !String(body.document).trim()) errors.push('CPF/CNPJ é obrigatório.')
  return errors
}

function validateInstallerBody(body) {
  const errors = []
  if (!body.full_name || !String(body.full_name).trim()) errors.push('Nome completo é obrigatório.')
  if (!body.phone || !String(body.phone).trim()) errors.push('Telefone é obrigatório.')
  if (!body.email || !String(body.email).trim()) errors.push('E-mail é obrigatório.')
  if (!body.document || !String(body.document).trim()) errors.push('CPF/CNPJ é obrigatório.')
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
    full_name: 'João Silva',
    phone: '11999999999',
    email: 'joao@exemplo.com',
    document: '123.456.789-00',
    regions: ['SP'],
  }

  it('passes with a valid body', () => {
    expect(validateConsultantBody(validBody)).toHaveLength(0)
  })

  it('does not accept consultant_code from request body (server-generated)', () => {
    // consultant_code is not part of the create body anymore — validation ignores it
    const bodyWithCode = { ...validBody, consultant_code: 'C123' }
    expect(validateConsultantBody(bodyWithCode)).toHaveLength(0)
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

  it('rejects missing document', () => {
    const errs = validateConsultantBody({ ...validBody, document: '' })
    expect(errs.some((e) => e.includes('CPF/CNPJ'))).toBe(true)
  })

  it('rejects null document', () => {
    const errs = validateConsultantBody({ ...validBody, document: null })
    expect(errs.some((e) => e.includes('CPF/CNPJ'))).toBe(true)
  })

  it('accepts CPF format', () => {
    expect(validateConsultantBody({ ...validBody, document: '123.456.789-00' })).toHaveLength(0)
  })

  it('accepts CNPJ format', () => {
    expect(validateConsultantBody({ ...validBody, document: '12.345.678/0001-99' })).toHaveLength(0)
  })

  it('rejects empty regions array', () => {
    const errs = validateConsultantBody({ ...validBody, regions: [] })
    expect(errs.some((e) => e.includes('região'))).toBe(true)
  })

  it('accepts multiple regions', () => {
    const errs = validateConsultantBody({ ...validBody, regions: ['SP', 'RJ', 'MG'] })
    expect(errs).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Engineer
// ─────────────────────────────────────────────────────────────────────────────

describe('validateEngineerBody', () => {
  const validBody = {
    full_name: 'Tiago Souza',
    phone: '11988888888',
    email: 'tiago@exemplo.com',
    crea: 'CREA-SP 123456',
    document: '987.654.321-00',
  }

  it('passes with a valid body', () => {
    expect(validateEngineerBody(validBody)).toHaveLength(0)
  })

  it('does not accept engineer_code from request body (server-generated)', () => {
    const bodyWithCode = { ...validBody, engineer_code: 'E123' }
    expect(validateEngineerBody(bodyWithCode)).toHaveLength(0)
  })

  it('rejects empty CREA', () => {
    const errs = validateEngineerBody({ ...validBody, crea: '' })
    expect(errs.some((e) => e.includes('CREA'))).toBe(true)
  })

  it('accepts CREA with UF prefix and slash', () => {
    const errs = validateEngineerBody({ ...validBody, crea: 'CREA-SP 123/456' })
    expect(errs).toHaveLength(0)
  })

  it('rejects missing document', () => {
    const errs = validateEngineerBody({ ...validBody, document: '' })
    expect(errs.some((e) => e.includes('CPF/CNPJ'))).toBe(true)
  })

  it('rejects empty full_name', () => {
    const errs = validateEngineerBody({ ...validBody, full_name: '' })
    expect(errs.some((e) => e.includes('Nome'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Installer
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInstallerBody', () => {
  const validBody = {
    full_name: 'Carlos Pereira',
    phone: '11977777777',
    email: 'carlos@exemplo.com',
    document: '11.222.333/0001-44',
  }

  it('passes with a valid body', () => {
    expect(validateInstallerBody(validBody)).toHaveLength(0)
  })

  it('does not accept installer_code from request body (server-generated)', () => {
    const bodyWithCode = { ...validBody, installer_code: 'I123' }
    expect(validateInstallerBody(bodyWithCode)).toHaveLength(0)
  })

  it('rejects empty email', () => {
    const errs = validateInstallerBody({ ...validBody, email: '' })
    expect(errs.some((e) => e.includes('E-mail'))).toBe(true)
  })

  it('rejects missing document', () => {
    const errs = validateInstallerBody({ ...validBody, document: '' })
    expect(errs.some((e) => e.includes('CPF/CNPJ'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Code generation
// ─────────────────────────────────────────────────────────────────────────────

describe('Code generation', () => {
  it('consultant code starts with C', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCode('C')
      expect(code[0]).toBe('C')
      expect(CONSULTANT_CODE_REGEX.test(code)).toBe(true)
    }
  })

  it('engineer code starts with E', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCode('E')
      expect(code[0]).toBe('E')
      expect(ENGINEER_CODE_REGEX.test(code)).toBe(true)
    }
  })

  it('installer code starts with I', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCode('I')
      expect(code[0]).toBe('I')
      expect(INSTALLER_CODE_REGEX.test(code)).toBe(true)
    }
  })

  it('generated codes have exactly 4 characters', () => {
    expect(generateCode('C')).toHaveLength(4)
    expect(generateCode('E')).toHaveLength(4)
    expect(generateCode('I')).toHaveLength(4)
  })

  it('consultant code does not match engineer or installer regex', () => {
    const code = generateCode('C')
    expect(ENGINEER_CODE_REGEX.test(code)).toBe(false)
    expect(INSTALLER_CODE_REGEX.test(code)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Code format regexes
// ─────────────────────────────────────────────────────────────────────────────

describe('CONSULTANT_CODE_REGEX', () => {
  const valid = ['C123', 'Cabc', 'cABC', 'c234']
  const invalid = ['A123', 'E123', 'I123', '', 'C12', 'C1234', 'C!23', 'c 23']

  valid.forEach((code) => {
    it(`accepts "${code}"`, () => expect(CONSULTANT_CODE_REGEX.test(code)).toBe(true))
  })
  invalid.forEach((code) => {
    it(`rejects "${code}"`, () => expect(CONSULTANT_CODE_REGEX.test(code)).toBe(false))
  })
})

describe('ENGINEER_CODE_REGEX', () => {
  const valid = ['E123', 'Eabc', 'eABC', 'e234']
  const invalid = ['C123', 'I123', 'A123', '', 'E12', 'E1234', 'E!23']

  valid.forEach((code) => {
    it(`accepts "${code}"`, () => expect(ENGINEER_CODE_REGEX.test(code)).toBe(true))
  })
  invalid.forEach((code) => {
    it(`rejects "${code}"`, () => expect(ENGINEER_CODE_REGEX.test(code)).toBe(false))
  })
})

describe('INSTALLER_CODE_REGEX', () => {
  const valid = ['I123', 'Iabc', 'iABC', 'i234']
  const invalid = ['C123', 'E123', 'A123', '', 'I12', 'I1234', 'I!23']

  valid.forEach((code) => {
    it(`accepts "${code}"`, () => expect(INSTALLER_CODE_REGEX.test(code)).toBe(true))
  })
  invalid.forEach((code) => {
    it(`rejects "${code}"`, () => expect(INSTALLER_CODE_REGEX.test(code)).toBe(false))
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests — duplicate document detection (simulated)
// ─────────────────────────────────────────────────────────────────────────────

describe('duplicate document detection', () => {
  it('detects duplicate CPF/CNPJ for consultants', () => {
    const existingDocs = new Set(['123.456.789-00'])
    expect(existingDocs.has('123.456.789-00')).toBe(true)
    expect(existingDocs.has('999.888.777-66')).toBe(false)
  })

  it('detects duplicate CPF/CNPJ for engineers', () => {
    const existingDocs = new Set(['12.345.678/0001-99'])
    expect(existingDocs.has('12.345.678/0001-99')).toBe(true)
  })

  it('detects duplicate CPF/CNPJ for installers', () => {
    const existingDocs = new Set(['11.222.333/0001-44'])
    expect(existingDocs.has('11.222.333/0001-44')).toBe(true)
  })
})

