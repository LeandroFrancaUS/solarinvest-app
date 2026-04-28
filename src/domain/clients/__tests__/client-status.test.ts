// src/domain/clients/__tests__/client-status.test.ts
import { describe, it, expect } from 'vitest'
import {
  isStatusComercial,
  isStatusCliente,
  deriveClientVisibility,
  applyContractSignedStatus,
  STATUS_COMERCIAL_VALUES,
  STATUS_CLIENTE_VALUES,
} from '../client-status'

// ─── isStatusComercial ────────────────────────────────────────────────────────

describe('isStatusComercial', () => {
  it('accepts all valid values', () => {
    for (const v of STATUS_COMERCIAL_VALUES) {
      expect(isStatusComercial(v)).toBe(true)
    }
  })

  it('rejects invalid strings', () => {
    expect(isStatusComercial('ATIVO')).toBe(false)
    expect(isStatusComercial('INVALID')).toBe(false)
    expect(isStatusComercial('')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isStatusComercial(null)).toBe(false)
    expect(isStatusComercial(undefined)).toBe(false)
    expect(isStatusComercial(42)).toBe(false)
  })
})

// ─── isStatusCliente ─────────────────────────────────────────────────────────

describe('isStatusCliente', () => {
  it('accepts all valid values', () => {
    for (const v of STATUS_CLIENTE_VALUES) {
      expect(isStatusCliente(v)).toBe(true)
    }
  })

  it('rejects invalid strings', () => {
    expect(isStatusCliente('LEAD')).toBe(false)
    expect(isStatusCliente('INVALID')).toBe(false)
    expect(isStatusCliente('')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isStatusCliente(null)).toBe(false)
    expect(isStatusCliente(undefined)).toBe(false)
    expect(isStatusCliente(42)).toBe(false)
  })
})

// ─── deriveClientVisibility ───────────────────────────────────────────────────

describe('deriveClientVisibility', () => {
  it('lead appears in Comercial, not in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'LEAD', status_cliente: 'NAO_CLIENTE' })
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })

  it('PROPOSTA_ENVIADA appears in Comercial, not in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'PROPOSTA_ENVIADA', status_cliente: 'NAO_CLIENTE' })
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })

  it('NEGOCIANDO appears in Comercial, not in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'NEGOCIANDO', status_cliente: 'NAO_CLIENTE' })
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })

  it('CONTRATO_ENVIADO appears in Comercial, not in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'CONTRATO_ENVIADO', status_cliente: 'NAO_CLIENTE' })
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })

  it('statusCliente ATIVO appears in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'GANHO', status_cliente: 'ATIVO' })
    expect(result.showInClientes).toBe(true)
  })

  it('GANHO does NOT appear in Comercial', () => {
    const result = deriveClientVisibility({ status_comercial: 'GANHO', status_cliente: 'ATIVO' })
    expect(result.showInComercial).toBe(false)
  })

  it('PERDIDO does NOT appear in Comercial', () => {
    const result = deriveClientVisibility({ status_comercial: 'PERDIDO', status_cliente: 'NAO_CLIENTE' })
    expect(result.showInComercial).toBe(false)
    expect(result.showInClientes).toBe(false)
  })

  it('INATIVO client appears in Clientes, not in Comercial', () => {
    const result = deriveClientVisibility({ status_comercial: 'GANHO', status_cliente: 'INATIVO' })
    expect(result.showInComercial).toBe(false)
    expect(result.showInClientes).toBe(true)
  })

  it('CANCELADO client appears in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'GANHO', status_cliente: 'CANCELADO' })
    expect(result.showInClientes).toBe(true)
  })

  it('FINALIZADO client appears in Clientes', () => {
    const result = deriveClientVisibility({ status_comercial: 'GANHO', status_cliente: 'FINALIZADO' })
    expect(result.showInClientes).toBe(true)
  })

  it('defaults missing fields to LEAD / NAO_CLIENTE', () => {
    const result = deriveClientVisibility({})
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })

  it('defaults null fields to LEAD / NAO_CLIENTE', () => {
    const result = deriveClientVisibility({ status_comercial: null, status_cliente: null })
    expect(result.showInComercial).toBe(true)
    expect(result.showInClientes).toBe(false)
  })
})

// ─── applyContractSignedStatus ────────────────────────────────────────────────

describe('applyContractSignedStatus', () => {
  it('sets statusComercial = GANHO and statusCliente = ATIVO', () => {
    const original = { status_comercial: 'LEAD' as const, status_cliente: 'NAO_CLIENTE' as const }
    const result = applyContractSignedStatus(original)
    expect(result.status_comercial).toBe('GANHO')
    expect(result.status_cliente).toBe('ATIVO')
  })

  it('does not mutate the original object', () => {
    const original = { status_comercial: 'NEGOCIANDO' as const, status_cliente: 'NAO_CLIENTE' as const }
    applyContractSignedStatus(original)
    expect(original.status_comercial).toBe('NEGOCIANDO')
    expect(original.status_cliente).toBe('NAO_CLIENTE')
  })

  it('preserves other fields from original', () => {
    const original = { status_comercial: 'LEAD' as const, status_cliente: 'NAO_CLIENTE' as const, id: 42 }
    const result = applyContractSignedStatus(original)
    expect((result as typeof original).id).toBe(42)
  })

  it('contract signed → contrato assinado aplica GANHO + ATIVO', () => {
    const result = applyContractSignedStatus({ status_comercial: 'CONTRATO_ENVIADO', status_cliente: 'NAO_CLIENTE' })
    expect(result.status_comercial).toBe('GANHO')
    expect(result.status_cliente).toBe('ATIVO')
  })
})
