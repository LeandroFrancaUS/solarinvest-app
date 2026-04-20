import { describe, it, expect } from 'vitest'
import {
  normalizeCep,
  isValidCep,
  isValidCpfOrCnpj,
  inferDocumentType,
  normalizePhone,
  isValidBrazilPhone,
  isValidEmail,
  normalizeUc,
  isValidUc,
  validateClientReadinessForContract,
  type ClientReadinessInput,
} from '../clientReadiness'

// ─── Helper to build a fully-valid input ──────────────────────────────────────

function validInput(): ClientReadinessInput {
  return {
    cep: '01001-000',
    document: '529.982.247-25', // real valid CPF
    phone: '11987654321',
    email: 'cliente@example.com',
    ucGeradora: '123456789012345',
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CEP
// ═════════════════════════════════════════════════════════════════════════════

describe('normalizeCep', () => {
  it('strips non-digit chars', () => {
    expect(normalizeCep('01001-000')).toBe('01001000')
  })
  it('returns empty string for null/undefined', () => {
    expect(normalizeCep(null)).toBe('')
    expect(normalizeCep(undefined)).toBe('')
  })
})

describe('isValidCep', () => {
  it('accepts 8-digit CEP without mask', () => {
    expect(isValidCep('01001000')).toBe(true)
  })
  it('accepts 8-digit CEP with mask', () => {
    expect(isValidCep('01001-000')).toBe(true)
  })
  it('rejects fewer than 8 digits', () => {
    expect(isValidCep('0100')).toBe(false)
  })
  it('rejects more than 8 digits', () => {
    expect(isValidCep('010010001')).toBe(false)
  })
  it('rejects all-zeros', () => {
    expect(isValidCep('00000-000')).toBe(false)
    expect(isValidCep('00000000')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(isValidCep('')).toBe(false)
  })
  it('rejects null/undefined', () => {
    expect(isValidCep(null)).toBe(false)
    expect(isValidCep(undefined)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CPF
// ═════════════════════════════════════════════════════════════════════════════

describe('isValidCpfOrCnpj — CPF', () => {
  it('accepts a valid CPF with mask', () => {
    expect(isValidCpfOrCnpj('529.982.247-25')).toBe(true)
  })
  it('accepts a valid CPF without mask', () => {
    expect(isValidCpfOrCnpj('52998224725')).toBe(true)
  })
  it('rejects CPF with all-same digits', () => {
    expect(isValidCpfOrCnpj('111.111.111-11')).toBe(false)
  })
  it('rejects CPF with wrong check digit', () => {
    expect(isValidCpfOrCnpj('123.456.789-00')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(isValidCpfOrCnpj('')).toBe(false)
  })
  it('rejects short input', () => {
    expect(isValidCpfOrCnpj('123.456')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CNPJ
// ═════════════════════════════════════════════════════════════════════════════

describe('isValidCpfOrCnpj — CNPJ', () => {
  it('accepts a valid CNPJ with mask', () => {
    expect(isValidCpfOrCnpj('11.222.333/0001-81')).toBe(true)
  })
  it('accepts a valid CNPJ without mask', () => {
    expect(isValidCpfOrCnpj('11222333000181')).toBe(true)
  })
  it('rejects CNPJ with all-same digits', () => {
    expect(isValidCpfOrCnpj('11.111.111/1111-11')).toBe(false)
  })
  it('rejects CNPJ with wrong check digit', () => {
    expect(isValidCpfOrCnpj('11.222.333/0001-00')).toBe(false)
  })
})

describe('inferDocumentType', () => {
  it('returns cpf for 11-digit input', () => {
    expect(inferDocumentType('529.982.247-25')).toBe('cpf')
  })
  it('returns cnpj for 14-digit input', () => {
    expect(inferDocumentType('11.222.333/0001-81')).toBe('cnpj')
  })
  it('returns null for other lengths', () => {
    expect(inferDocumentType('123')).toBe(null)
    expect(inferDocumentType('')).toBe(null)
    expect(inferDocumentType(null)).toBe(null)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Phone
// ═════════════════════════════════════════════════════════════════════════════

describe('normalizePhone', () => {
  it('strips non-digit chars', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321')
  })
  it('returns empty string for null/undefined', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
})

describe('isValidBrazilPhone', () => {
  it('accepts 11-digit mobile (DDD + 9 digits)', () => {
    expect(isValidBrazilPhone('11987654321')).toBe(true)
  })
  it('accepts 10-digit landline (DDD + 8 digits)', () => {
    expect(isValidBrazilPhone('1132654321')).toBe(true)
  })
  it('accepts phone with punctuation', () => {
    expect(isValidBrazilPhone('(11) 98765-4321')).toBe(true)
  })
  it('rejects fewer than 10 digits', () => {
    expect(isValidBrazilPhone('987654321')).toBe(false)
  })
  it('rejects more than 11 digits', () => {
    expect(isValidBrazilPhone('119876543210')).toBe(false)
  })
  it('rejects DDD starting with 0', () => {
    expect(isValidBrazilPhone('01987654321')).toBe(false)
  })
  it('rejects all-zeros', () => {
    expect(isValidBrazilPhone('00000000000')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(isValidBrazilPhone('')).toBe(false)
  })
  it('rejects null/undefined', () => {
    expect(isValidBrazilPhone(null)).toBe(false)
    expect(isValidBrazilPhone(undefined)).toBe(false)
  })
  it('rejects [object Object]', () => {
    expect(isValidBrazilPhone('[object Object]')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Email
// ═════════════════════════════════════════════════════════════════════════════

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })
  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com.br')).toBe(true)
  })
  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
  it('rejects null/undefined', () => {
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
  })
  it('rejects string without @', () => {
    expect(isValidEmail('userdomain.com')).toBe(false)
  })
  it('rejects string without domain part', () => {
    expect(isValidEmail('user@')).toBe(false)
  })
  it('rejects placeholder strings', () => {
    expect(isValidEmail('teste')).toBe(false)
    expect(isValidEmail('t')).toBe(false)
    expect(isValidEmail('null')).toBe(false)
    expect(isValidEmail('undefined')).toBe(false)
    expect(isValidEmail('[object Object]')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// UC
// ═════════════════════════════════════════════════════════════════════════════

describe('normalizeUc', () => {
  it('strips non-digit chars', () => {
    expect(normalizeUc('123.456.789.012.345')).toBe('123456789012345')
  })
  it('returns empty string for null/undefined', () => {
    expect(normalizeUc(null)).toBe('')
    expect(normalizeUc(undefined)).toBe('')
  })
})

describe('isValidUc', () => {
  it('accepts exactly 15 digits', () => {
    expect(isValidUc('123456789012345')).toBe(true)
  })
  it('accepts 15 digits with formatting', () => {
    expect(isValidUc('12345 67890 12345')).toBe(true)
  })
  it('rejects fewer than 15 digits', () => {
    expect(isValidUc('12345678')).toBe(false)
  })
  it('rejects more than 15 digits', () => {
    expect(isValidUc('1234567890123456')).toBe(false)
  })
  it('rejects all-zeros', () => {
    expect(isValidUc('000000000000000')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(isValidUc('')).toBe(false)
  })
  it('rejects null/undefined', () => {
    expect(isValidUc(null)).toBe(false)
    expect(isValidUc(undefined)).toBe(false)
  })
  it('rejects non-numeric text', () => {
    expect(isValidUc('ABCDE12345FGHIJ')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// validateClientReadinessForContract — integration
// ═════════════════════════════════════════════════════════════════════════════

describe('validateClientReadinessForContract', () => {
  describe('all fields valid', () => {
    it('returns ok=true with no issues', () => {
      const result = validateClientReadinessForContract(validInput())
      expect(result.ok).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('passes with valid CNPJ', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        document: '11.222.333/0001-81',
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('blocks when fields are invalid', () => {
    it('blocks when CEP is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        cep: '0100',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'cep')).toBe(true)
    })

    it('blocks when CEP is all-zeros placeholder', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        cep: '00000-000',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'cep')).toBe(true)
    })

    it('blocks when CPF is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        document: '111.111.111-11',
      })
      expect(result.ok).toBe(false)
      const issue = result.issues.find((i) => i.field === 'document')
      expect(issue).toBeDefined()
      expect(issue?.message).toContain('CPF')
    })

    it('blocks when CNPJ is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        document: '11.222.333/0001-00',
      })
      expect(result.ok).toBe(false)
      const issue = result.issues.find((i) => i.field === 'document')
      expect(issue?.message).toContain('CNPJ')
    })

    it('blocks when phone is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        phone: '98765',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'phone')).toBe(true)
    })

    it('blocks when email is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        email: 'nao-e-um-email',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'email')).toBe(true)
    })

    it('blocks when UC geradora is invalid (too short)', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        ucGeradora: '12345678',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'ucGeradora')).toBe(true)
    })

    it('blocks when UC geradora is missing', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        ucGeradora: '',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'ucGeradora')).toBe(true)
    })
  })

  describe('UC beneficiárias', () => {
    it('passes when ucBeneficiarias is empty array', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        ucBeneficiarias: [],
      })
      expect(result.ok).toBe(true)
    })

    it('passes when ucBeneficiarias is omitted', () => {
      const result = validateClientReadinessForContract({
        cep: validInput().cep,
        document: validInput().document,
        phone: validInput().phone,
        email: validInput().email,
        ucGeradora: validInput().ucGeradora,
      })
      expect(result.ok).toBe(true)
    })

    it('blocks when a UC beneficiária is invalid', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        ucBeneficiarias: ['123456789012345', 'curta'],
      })
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.field === 'ucBeneficiaria_1')).toBe(true)
    })

    it('passes when all UC beneficiárias are valid 15-digit numbers', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        ucBeneficiarias: ['123456789012345', '987654321098765'],
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('collects all issues at once', () => {
    it('reports all failing fields in a single call', () => {
      const result = validateClientReadinessForContract({
        cep: '000',
        document: '',
        phone: '',
        email: '',
        ucGeradora: '',
      })
      expect(result.ok).toBe(false)
      expect(result.issues.length).toBeGreaterThanOrEqual(5)
      const fields = result.issues.map((i) => i.field)
      expect(fields).toContain('cep')
      expect(fields).toContain('document')
      expect(fields).toContain('phone')
      expect(fields).toContain('email')
      expect(fields).toContain('ucGeradora')
    })
  })

  describe('gate: blocks "Negócio Fechado" when data is invalid', () => {
    it('returns ok=false so the caller must abort the portfolio export', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        cep: 'invalid',
      })
      expect(result.ok).toBe(false)
    })
  })

  describe('gate: blocks "Gerar contratos" when data is invalid', () => {
    it('returns ok=false so the caller must abort contract generation', () => {
      const result = validateClientReadinessForContract({
        ...validInput(),
        phone: '0000000',
      })
      expect(result.ok).toBe(false)
    })
  })

  describe('gate: allows actions when all data is valid', () => {
    it('returns ok=true so the caller may proceed', () => {
      const result = validateClientReadinessForContract(validInput())
      expect(result.ok).toBe(true)
    })
  })
})
