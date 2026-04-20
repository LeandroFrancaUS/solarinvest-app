// src/utils/__tests__/hydrateClientComputedFields.test.ts
import { describe, it, expect } from 'vitest'
import { hydrateClientComputedFields } from '../hydrateClientComputedFields'
import type { PortfolioClientRow } from '../../types/clientPortfolio'

// Minimal stub for a PortfolioClientRow with all fields empty
function emptyClient(overrides: Partial<PortfolioClientRow> = {}): PortfolioClientRow {
  return {
    id: 1,
    name: 'Test',
    email: null,
    phone: null,
    city: null,
    state: null,
    document: null,
    document_type: null,
    consumption_kwh_month: null,
    system_kwp: null,
    term_months: null,
    distribuidora: null,
    uc: null,
    uc_beneficiaria: null,
    owner_user_id: null,
    created_by_user_id: null,
    client_created_at: '',
    is_converted_customer: true,
    exported_to_portfolio_at: null,
    exported_by_user_id: null,
    potencia_kwp: null,
    potencia_modulo_wp: null,
    numero_modulos: null,
    area_instalacao_m2: null,
    geracao_estimada_kwh: null,
    tipo_instalacao: null,
    modelo_modulo: null,
    modelo_inversor: null,
    valordemercado: null,
    metadata: null,
    ...overrides,
  }
}

describe('hydrateClientComputedFields', () => {
  it('returns null when metadata.autoFilled is true', () => {
    const client = emptyClient({ metadata: { autoFilled: true } })
    expect(hydrateClientComputedFields(client, {})).toBeNull()
  })

  it('returns null when no payload and no fillable fields', () => {
    const client = emptyClient()
    const result = hydrateClientComputedFields(client, null)
    // Without a payload, only consumption_kwh_month could fill geracao — which is null
    expect(result).toBeNull()
  })

  it('fills system_kwp from leasingSnapshot', () => {
    const client = emptyClient()
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 8.5 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result).not.toBeNull()
    expect(result!.system_kwp).toBe(8.5)
    expect(result!.energyProfile?.potencia_kwp).toBe(8.5)
  })

  it('fills system_kwp from vendaSnapshot when leasingSnapshot absent', () => {
    const client = emptyClient()
    const payload = {
      vendaSnapshot: {
        configuracao: { potencia_sistema_kwp: 6.6 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.system_kwp).toBe(6.6)
  })

  it('calculates numero_modulos and area from potencia when not provided', () => {
    const client = emptyClient()
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: {
          potenciaInstaladaKwp: 5.5,
          potenciaPlacaWp: 550,
        },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.numero_modulos).toBe(10) // 5500 / 550 = 10
    expect(result!.area_instalacao_m2).toBe(22) // 10 * 2.2 = 22
  })

  it('uses default 550W module when potencia_modulo_wp not provided', () => {
    const client = emptyClient()
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 5.5 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.potencia_modulo_wp).toBe(550)
    expect(result!.numero_modulos).toBe(10) // 5500 / 550
  })

  it('does not overwrite existing system_kwp', () => {
    const client = emptyClient({ system_kwp: 7.0 })
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 8.5 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result?.system_kwp).toBeUndefined()
    // But the other fields (potencia_modulo_wp etc.) may still be filled
  })

  it('sets metadata.autoFilled = true in the update', () => {
    const client = emptyClient()
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 4.4 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.metadata.autoFilled).toBe(true)
  })

  it('fills valordemercado from vendaSnapshot.composicao.venda_total', () => {
    const client = emptyClient()
    const payload = {
      vendaSnapshot: {
        configuracao: { potencia_sistema_kwp: 4.0 },
        composicao: { venda_total: 35000 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.valordemercado).toBe(35000)
  })

  it('fills valordemercado from leasingSnapshot.valorDeMercadoEstimado as fallback', () => {
    const client = emptyClient()
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 3.3 },
        valorDeMercadoEstimado: 28000,
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.valordemercado).toBe(28000)
  })

  it('preserves existing metadata keys when setting autoFilled', () => {
    const client = emptyClient({ metadata: { someKey: 'value' } })
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 3.0 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.metadata.someKey).toBe('value')
    expect(result!.metadata.autoFilled).toBe(true)
  })

  it('fills geracao_estimada_kwh from consumption_kwh_month as last resort', () => {
    const client = emptyClient({ consumption_kwh_month: 800 })
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: { potenciaInstaladaKwp: 5.0 },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.geracao_estimada_kwh).toBe(800)
  })

  it('fills geracao from leasingSnapshot before consumption fallback', () => {
    const client = emptyClient({ consumption_kwh_month: 800 })
    const payload = {
      leasingSnapshot: {
        dadosTecnicos: {
          potenciaInstaladaKwp: 5.0,
          geracaoEstimadakWhMes: 650,
        },
      },
    }
    const result = hydrateClientComputedFields(client, payload)
    expect(result!.geracao_estimada_kwh).toBe(650)
  })
})
