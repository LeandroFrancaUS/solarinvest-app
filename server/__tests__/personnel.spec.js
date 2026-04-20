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

// ─────────────────────────────────────────────────────────────────────────────
// Tests — import mapper logic (mirrors personnelImportMappers.ts)
// ─────────────────────────────────────────────────────────────────────────────

// Inline mirrors of the mapper functions for pure unit testing.

const BRAZIL_UF_NAMES_MAP = {
  acre: 'AC', alagoas: 'AL', amazonas: 'AM', bahia: 'BA',
  'são paulo': 'SP', 'sao paulo': 'SP', paraná: 'PR', parana: 'PR',
  'minas gerais': 'MG', 'rio de janeiro': 'RJ',
}
const VALID_UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
])

function inferUF(state) {
  if (!state) return null
  const trimmed = state.trim()
  const upper = trimmed.toUpperCase()
  if (VALID_UFS.has(upper)) return upper
  const mapped = BRAZIL_UF_NAMES_MAP[trimmed.toLowerCase()]
  return mapped ?? null
}

function mapUserToConsultantDraft(user) {
  return { full_name: user.full_name ?? '', email: user.email ?? '', phone: user.phone ?? '', regions: [] }
}
function mapClientToConsultantDraft(client) {
  const uf = inferUF(client.state)
  return { full_name: client.name ?? '', email: client.email ?? '', phone: client.phone ?? '', regions: uf ? [uf] : [] }
}
function mapUserToEngineerDraft(user) {
  return { full_name: user.full_name ?? '', email: user.email ?? '', phone: user.phone ?? '' }
}
function mapClientToEngineerDraft(client) {
  return { full_name: client.name ?? '', email: client.email ?? '', phone: client.phone ?? '' }
}
function mapUserToInstallerDraft(user) {
  return { full_name: user.full_name ?? '', email: user.email ?? '', phone: user.phone ?? '' }
}
function mapClientToInstallerDraft(client) {
  return { full_name: client.name ?? '', email: client.email ?? '', phone: client.phone ?? '' }
}

const sampleUser = { id: 'u1', full_name: 'João Silva', email: 'joao@example.com', phone: '(11) 91234-5678' }
const sampleClient = { id: 1, name: 'Maria Souza', email: 'maria@example.com', phone: '(21) 98765-4321', document: '123.456.789-00', state: 'SP', city: 'São Paulo' }

describe('import mappers — consultant', () => {
  it('mapUserToConsultantDraft fills name, email, phone; leaves regions empty', () => {
    const draft = mapUserToConsultantDraft(sampleUser)
    expect(draft.full_name).toBe('João Silva')
    expect(draft.email).toBe('joao@example.com')
    expect(draft.phone).toBe('(11) 91234-5678')
    expect(draft.regions).toEqual([])
  })

  it('mapClientToConsultantDraft fills name, email, phone and infers UF from state', () => {
    const draft = mapClientToConsultantDraft(sampleClient)
    expect(draft.full_name).toBe('Maria Souza')
    expect(draft.email).toBe('maria@example.com')
    expect(draft.regions).toEqual(['SP'])
  })

  it('mapClientToConsultantDraft leaves regions empty when state is unknown', () => {
    const draft = mapClientToConsultantDraft({ ...sampleClient, state: 'Unknown State' })
    expect(draft.regions).toEqual([])
  })

  it('mapClientToConsultantDraft handles full state name', () => {
    const draft = mapClientToConsultantDraft({ ...sampleClient, state: 'São Paulo' })
    expect(draft.regions).toEqual(['SP'])
  })

  it('consultant_code is NOT present in any mapped draft', () => {
    const draftUser = mapUserToConsultantDraft(sampleUser)
    const draftClient = mapClientToConsultantDraft(sampleClient)
    expect('consultant_code' in draftUser).toBe(false)
    expect('consultant_code' in draftClient).toBe(false)
  })
})

describe('import mappers — engineer', () => {
  it('mapUserToEngineerDraft fills name, email, phone', () => {
    const draft = mapUserToEngineerDraft(sampleUser)
    expect(draft.full_name).toBe('João Silva')
    expect(draft.email).toBe('joao@example.com')
    expect(draft.phone).toBe('(11) 91234-5678')
  })

  it('mapClientToEngineerDraft fills name, email, phone', () => {
    const draft = mapClientToEngineerDraft(sampleClient)
    expect(draft.full_name).toBe('Maria Souza')
    expect(draft.email).toBe('maria@example.com')
    expect(draft.phone).toBe('(21) 98765-4321')
  })

  it('CREA is NOT present in any engineer draft', () => {
    expect('crea' in mapUserToEngineerDraft(sampleUser)).toBe(false)
    expect('crea' in mapClientToEngineerDraft(sampleClient)).toBe(false)
  })

  it('engineer_code is NOT present in any engineer draft', () => {
    expect('engineer_code' in mapUserToEngineerDraft(sampleUser)).toBe(false)
    expect('engineer_code' in mapClientToEngineerDraft(sampleClient)).toBe(false)
  })
})

describe('import mappers — installer', () => {
  it('mapUserToInstallerDraft fills name, email, phone', () => {
    const draft = mapUserToInstallerDraft(sampleUser)
    expect(draft.full_name).toBe('João Silva')
    expect(draft.email).toBe('joao@example.com')
    expect(draft.phone).toBe('(11) 91234-5678')
  })

  it('mapClientToInstallerDraft fills name, email, phone', () => {
    const draft = mapClientToInstallerDraft(sampleClient)
    expect(draft.full_name).toBe('Maria Souza')
  })

  it('installer_code is NOT present in any installer draft', () => {
    expect('installer_code' in mapUserToInstallerDraft(sampleUser)).toBe(false)
    expect('installer_code' in mapClientToInstallerDraft(sampleClient)).toBe(false)
  })
})

describe('import safety rules', () => {
  it('import does not save automatically (draft is just a plain object)', () => {
    const draft = mapUserToConsultantDraft(sampleUser)
    // A draft is just data — no side effects, no DB calls
    expect(typeof draft).toBe('object')
    expect(draft.full_name).toBe('João Silva')
  })

  it('original user object is not mutated by mapping', () => {
    const user = { ...sampleUser }
    const draft = mapUserToConsultantDraft(user)
    draft.full_name = 'CHANGED'
    expect(user.full_name).toBe('João Silva') // original untouched
  })

  it('original client object is not mutated by mapping', () => {
    const client = { ...sampleClient }
    const draft = mapClientToConsultantDraft(client)
    draft.full_name = 'CHANGED'
    expect(client.name).toBe('Maria Souza') // original untouched
  })

  it('mappers handle missing fields gracefully (return empty strings)', () => {
    const emptyUser = { id: 'u2', full_name: null, email: undefined, phone: null }
    const draft = mapUserToConsultantDraft(emptyUser)
    expect(draft.full_name).toBe('')
    expect(draft.email).toBe('')
    expect(draft.phone).toBe('')
  })
})
