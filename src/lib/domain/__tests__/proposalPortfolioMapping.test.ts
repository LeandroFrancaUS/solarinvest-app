// src/lib/domain/__tests__/proposalPortfolioMapping.test.ts
import { describe, it, expect } from 'vitest'
import {
  mapProposalDataToPortfolioFields,
  type SnapshotInput,
  type ClienteDadosInput,
} from '../proposalPortfolioMapping'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fullLeasingSnapshot: SnapshotInput = {
  activeTab: 'leasing',
  kcKwhMes: 800,
  prazoMeses: 240,
  tarifaCheia: 0.85,
  tipoRede: 'trifasico',
  tipoInstalacao: 'telhado_ceramico',
  leasingSnapshot: {
    prazoContratualMeses: 240,
    descontoContratual: 20,
    tarifaInicial: 0.85,
    valorDeMercadoEstimado: 45000,
    energiaContratadaKwhMes: 700,
    dadosTecnicos: {
      potenciaInstaladaKwp: 8.25,
      geracaoEstimadakWhMes: 930,
      energiaContratadaKwhMes: 700,
      potenciaPlacaWp: 550,
      numeroModulos: 15,
      tipoInstalacao: 'telhado_ceramico',
      areaUtilM2: 33,
    },
    projecao: {
      mensalidadesAno: [{ mensalidade: 350 }],
    },
    contrato: {
      inversoresFV: 'Growatt MIN 8000TL',
    },
  },
}

const fullVendaSnapshot: SnapshotInput = {
  activeTab: 'venda',
  kcKwhMes: 600,
  prazoMeses: 0,
  tarifaCheia: 0.92,
  tipoRede: 'bifasico',
  vendaSnapshot: {
    configuracao: {
      potencia_sistema_kwp: 6.6,
      geracao_estimada_kwh_mes: 750,
      potencia_modulo_wp: 550,
      n_modulos: 12,
      area_m2: 26.4,
      tipo_instalacao: 'telhado_fibrocimento',
      modelo_modulo: 'Canadian Solar 550W',
      modelo_inversor: 'Fronius Primo 5.0',
    },
    composicao: {
      venda_total: 28000,
      desconto_percentual: 5,
    },
    parametros: {
      consumo_kwh_mes: 600,
      tarifa_r_kwh: 0.92,
    },
    potenciaCalculadaKwp: 6.6,
  },
}

const fullCliente: ClienteDadosInput = {
  nome: 'João da Silva',
  documento: '529.982.247-25',
  email: 'joao@example.com',
  telefone: '11987654321',
  cep: '01001-000',
  cidade: 'São Paulo',
  uf: 'SP',
  endereco: 'Rua Exemplo, 123',
  distribuidora: 'Enel São Paulo',
  uc: '123456789012345',
  indicacaoNome: 'Maria Santos',
  temIndicacao: true,
  diaVencimento: '10',
}

// ═════════════════════════════════════════════════════════════════════════════
// Leasing snapshot mapping
// ═════════════════════════════════════════════════════════════════════════════

describe('mapProposalDataToPortfolioFields — leasing snapshot', () => {
  it('maps client registration fields from ClienteDados', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.clients.client_name).toBe('João da Silva')
    expect(result.clients.client_document).toBe('529.982.247-25')
    expect(result.clients.client_email).toBe('joao@example.com')
    expect(result.clients.client_phone).toBe('11987654321')
    expect(result.clients.client_cep).toBe('01001000')
    expect(result.clients.client_city).toBe('São Paulo')
    expect(result.clients.client_state).toBe('SP')
    expect(result.clients.client_address).toBe('Rua Exemplo, 123')
    expect(result.clients.distribuidora).toBe('Enel São Paulo')
    expect(result.clients.uc).toBe('123456789012345')
  })

  it('maps system_kwp from leasingSnapshot.dadosTecnicos.potenciaInstaladaKwp', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.clients.system_kwp).toBe(8.25)
  })

  it('maps consumption_kwh_month from kcKwhMes', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.clients.consumption_kwh_month).toBe(800)
  })

  it('maps term_months from prazoMeses', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.clients.term_months).toBe(240)
  })

  it('maps usina fields from leasingSnapshot.dadosTecnicos', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.usinaConfig.potencia_modulo_wp).toBe(550)
    expect(result.usinaConfig.numero_modulos).toBe(15)
    expect(result.usinaConfig.tipo_instalacao).toBe('telhado_ceramico')
    expect(result.usinaConfig.area_instalacao_m2).toBe(33)
    expect(result.usinaConfig.geracao_estimada_kwh).toBe(930)
  })

  it('maps modelo_inversor from leasingSnapshot.contrato.inversoresFV', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.usinaConfig.modelo_inversor).toBe('Growatt MIN 8000TL')
  })

  it('maps valordemercado from leasingSnapshot.valorDeMercadoEstimado', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.usinaConfig.valordemercado).toBe(45000)
  })

  it('maps contract_type as leasing', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.contract.contract_type).toBe('leasing')
    expect(result.contract.contractual_term_months).toBe(240)
  })

  it('maps energy profile fields', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.energyProfile.kwh_contratado).toBe(700)
    expect(result.energyProfile.potencia_kwp).toBe(8.25)
    expect(result.energyProfile.tarifa_atual).toBe(0.85)
    expect(result.energyProfile.desconto_percentual).toBe(20)
    expect(result.energyProfile.mensalidade).toBe(350)
    expect(result.energyProfile.indicacao).toBe('Maria Santos')
    expect(result.energyProfile.prazo_meses).toBe(240)
  })

  it('maps due_day from cliente.diaVencimento', () => {
    const result = mapProposalDataToPortfolioFields(fullLeasingSnapshot, fullCliente)
    expect(result.billingProfile.due_day).toBe(10)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Venda snapshot mapping
// ═════════════════════════════════════════════════════════════════════════════

describe('mapProposalDataToPortfolioFields — venda snapshot', () => {
  it('maps system_kwp from vendaSnapshot.configuracao', () => {
    const result = mapProposalDataToPortfolioFields(fullVendaSnapshot, fullCliente)
    expect(result.clients.system_kwp).toBe(6.6)
  })

  it('maps geracao_estimada_kwh from vendaSnapshot.configuracao', () => {
    const result = mapProposalDataToPortfolioFields(fullVendaSnapshot, fullCliente)
    expect(result.usinaConfig.geracao_estimada_kwh).toBe(750)
  })

  it('maps modelo_modulo and modelo_inversor from venda', () => {
    const result = mapProposalDataToPortfolioFields(fullVendaSnapshot, fullCliente)
    expect(result.usinaConfig.modelo_modulo).toBe('Canadian Solar 550W')
    expect(result.usinaConfig.modelo_inversor).toBe('Fronius Primo 5.0')
  })

  it('maps valordemercado from vendaSnapshot.composicao.venda_total', () => {
    const result = mapProposalDataToPortfolioFields(fullVendaSnapshot, fullCliente)
    expect(result.usinaConfig.valordemercado).toBe(28000)
  })

  it('maps contract_type as sale', () => {
    const result = mapProposalDataToPortfolioFields(fullVendaSnapshot, fullCliente)
    expect(result.contract.contract_type).toBe('sale')
  })

  it('maps consumption from venda parametros when kcKwhMes is zero', () => {
    const snapshot: SnapshotInput = {
      ...fullVendaSnapshot,
      kcKwhMes: 0,
    }
    const result = mapProposalDataToPortfolioFields(snapshot, fullCliente)
    expect(result.clients.consumption_kwh_month).toBe(600)
  })

  it('maps tarifa_atual from venda parametros', () => {
    const snapshot: SnapshotInput = { ...fullVendaSnapshot, tarifaCheia: 0 }
    const result = mapProposalDataToPortfolioFields(snapshot, fullCliente)
    expect(result.energyProfile.tarifa_atual).toBe(0.92)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Partial / missing data handling
// ═════════════════════════════════════════════════════════════════════════════

describe('mapProposalDataToPortfolioFields — partial data', () => {
  it('returns empty groups when snapshot has no usina data', () => {
    const result = mapProposalDataToPortfolioFields({}, fullCliente)
    expect(result.usinaConfig).toEqual({})
  })

  it('still returns client registration data even with empty snapshot', () => {
    const result = mapProposalDataToPortfolioFields({}, fullCliente)
    expect(result.clients.client_name).toBe('João da Silva')
    expect(result.clients.distribuidora).toBe('Enel São Paulo')
  })

  it('defaults contract_type to leasing when activeTab is absent', () => {
    const result = mapProposalDataToPortfolioFields({}, fullCliente)
    expect(result.contract.contract_type).toBe('leasing')
  })

  it('does not include undefined fields in the clients payload', () => {
    const result = mapProposalDataToPortfolioFields({}, {})
    // An empty snapshot + empty cliente should produce an empty clients object
    expect(Object.keys(result.clients).length).toBe(0)
  })

  it('prioritizes leasingSnapshot over vendaSnapshot for system_kwp', () => {
    const mixed: SnapshotInput = {
      leasingSnapshot: { dadosTecnicos: { potenciaInstaladaKwp: 10 } },
      vendaSnapshot: { configuracao: { potencia_sistema_kwp: 5 } },
    }
    const result = mapProposalDataToPortfolioFields(mixed, {})
    expect(result.clients.system_kwp).toBe(10)
  })

  it('falls back to vendaSnapshot when leasingSnapshot is absent', () => {
    const vendaOnly: SnapshotInput = {
      vendaSnapshot: { configuracao: { potencia_sistema_kwp: 7.7 } },
    }
    const result = mapProposalDataToPortfolioFields(vendaOnly, {})
    expect(result.clients.system_kwp).toBe(7.7)
  })

  it('strips non-digit characters from CEP', () => {
    const result = mapProposalDataToPortfolioFields({}, { cep: '12345-678' })
    expect(result.clients.client_cep).toBe('12345678')
  })

  it('omits due_day when diaVencimento is empty', () => {
    const result = mapProposalDataToPortfolioFields({}, { diaVencimento: '' })
    expect(result.billingProfile.due_day).toBeUndefined()
  })
})
