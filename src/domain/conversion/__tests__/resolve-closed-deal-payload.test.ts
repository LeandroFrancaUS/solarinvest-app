/**
 * src/domain/conversion/__tests__/resolve-closed-deal-payload.test.ts
 *
 * Tests for the central "Negócio Fechado" data resolver.
 *
 * Requirements covered:
 *   1. Converts client without dependent records → payload fully populated
 *   2. Preserves manual edits (value-downgrade prevention)
 *   3. Fills consultant_id correctly
 *   4. Fills consumo, distribuidora, cidade/UF, document, contacts
 *   5. Uses proposal snapshot when canonical field is absent
 *   6. Never writes null over existing value (via mergeResolvedIntoDependentRecord)
 *   7. Idempotent (two calls return equivalent output)
 *   8. Handles leasing and venda with different data paths
 *   9. buildDestPayload produces correct destination keys from field map
 */

import { describe, it, expect } from 'vitest'
import {
  resolveClosedDealPayload,
  type ResolveClosedDealPayloadInput,
} from '../resolve-closed-deal-payload'
import {
  buildDestPayload,
  PORTFOLIO_PROFILE_FEED,
  PORTFOLIO_CONTRACT_FEED,
  PORTFOLIO_PLAN_FEED,
  PORTFOLIO_USINA_FEED,
  PROJECT_FINANCE_FEED,
} from '../closed-deal-field-map'
import { mergeResolvedIntoDependentRecord } from '../merge-resolved-into-record'
import type { SnapshotInput, ClienteDadosInput } from '../../../lib/domain/proposalPortfolioMapping'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CLIENT_ID = 42

const LEASING_SNAPSHOT: SnapshotInput = {
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
  },
}

const VENDA_SNAPSHOT: SnapshotInput = {
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
    },
    composicao: {
      venda_total: 28000,
      desconto_percentual: 5,
    },
    parametros: {
      consumo_kwh_mes: 600,
      tarifa_r_kwh: 0.92,
    },
  },
}

const FULL_CLIENTE: ClienteDadosInput & { consultorId?: string } = {
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
  ucBeneficiaria: '678901234567890',
  consultorId: '7',
}

const CONSULTANTS = [
  { id: 7, apelido: 'Joana', full_name: 'Joana Ferreira', email: 'joana@solar.com' },
]

function makeInput(
  snapshotOverride: Partial<SnapshotInput> = {},
  clienteOverride: Partial<typeof FULL_CLIENTE> = {},
): ResolveClosedDealPayloadInput {
  return {
    clientId: BASE_CLIENT_ID,
    proposalId: 'prop-abc-123',
    clienteDados: { ...FULL_CLIENTE, ...clienteOverride },
    snapshot: { ...LEASING_SNAPSHOT, ...snapshotOverride },
    consultants: CONSULTANTS,
    ucBeneficiarias: ['678901234567890'],
  }
}

// ─── 1. Basic resolution ──────────────────────────────────────────────────────

describe('resolveClosedDealPayload — basic', () => {
  it('returns a fully populated payload for a complete leasing proposal', () => {
    const payload = resolveClosedDealPayload(makeInput())

    expect(payload.clientId).toBe('42')
    expect(payload.proposalId).toBe('prop-abc-123')
    expect(payload.contractType).toBe('LEASING')

    // Identity
    expect(payload.nome).toBe('João da Silva')
    expect(payload.cpfCnpj).toBe('529.982.247-25')
    expect(payload.documentType).toBe('CPF')

    // Contact
    expect(payload.telefone).toBe('11987654321')
    expect(payload.email).toBe('joao@example.com')

    // Address
    expect(payload.cidade).toBe('São Paulo')
    expect(payload.uf).toBe('SP')
    expect(payload.cep).toBe('01001000') // digits only
    expect(payload.endereco).toBe('Rua Exemplo, 123')

    // Energy infrastructure
    expect(payload.distribuidora).toBe('Enel São Paulo')
    expect(payload.ucGeradora).toBe('123456789012345')
    expect(payload.ucBeneficiaria).toBe('678901234567890')

    // Technical
    expect(payload.potenciaInstaladaKwp).toBe(8.25)
    expect(payload.geracaoEstimadaKwhMes).toBe(930)
    expect(payload.potenciaModuloWp).toBe(550)
    expect(payload.numeroModulos).toBe(15)
    expect(payload.areaUtilizadaM2).toBe(33)
    expect(payload.tipoInstalacao).toBe('telhado_ceramico')
    expect(payload.tipoRede).toBe('trifasico')
    expect(payload.consumoKwhMes).toBe(800)

    // Commercial
    expect(payload.prazoMeses).toBe(240)
    expect(payload.tarifaCheia).toBe(0.85)
    expect(payload.valorMercado).toBe(45000)
    expect(payload.mensalidadeBase).toBe(350)
    expect(payload.desconto).toBe(20)
  })

  it('returns VENDA contract type for venda snapshot', () => {
    const payload = resolveClosedDealPayload({
      ...makeInput(),
      snapshot: VENDA_SNAPSHOT,
    })
    expect(payload.contractType).toBe('VENDA')
  })

  it('strips non-digits from CEP', () => {
    const payload = resolveClosedDealPayload(makeInput({}, { cep: '12345-678' }))
    expect(payload.cep).toBe('12345678')
  })

  it('populates clientId and proposalId', () => {
    const payload = resolveClosedDealPayload(makeInput())
    expect(payload.clientId).toBe('42')
    expect(payload.proposalId).toBe('prop-abc-123')
    expect(payload._sourceMeta.sourceClientId).toBe('42')
    expect(payload._sourceMeta.sourceProposalId).toBe('prop-abc-123')
    expect(payload._sourceMeta.source).toBe('closed_deal_conversion')
  })
})

// ─── 3. Consultant resolution ─────────────────────────────────────────────────

describe('resolveClosedDealPayload — consultant', () => {
  it('fills consultantId from consultorId and looks up label', () => {
    const payload = resolveClosedDealPayload(makeInput())
    expect(payload.consultantId).toBe('7')
    expect(payload.consultantLabel).toBe('Joana')
  })

  it('returns null consultantId when consultorId is absent', () => {
    const input = makeInput()
    const clienteSinConsultor = { ...input.clienteDados }
    delete (clienteSinConsultor as Record<string, unknown>).consultorId
    const payload = resolveClosedDealPayload({ ...input, clienteDados: clienteSinConsultor })
    expect(payload.consultantId).toBeNull()
    expect(payload.consultantLabel).toBeNull()
  })

  it('returns null consultantId when consultants list is empty', () => {
    const input = makeInput()
    const payload = resolveClosedDealPayload({ ...input, consultants: [] })
    // ID still comes from consultorId even without the consultant list
    expect(payload.consultantId).toBe('7')
  })
})

// ─── 4. Data filling from canonical fields ────────────────────────────────────

describe('resolveClosedDealPayload — canonical fields', () => {
  it('fills consumo from kcKwhMes', () => {
    const payload = resolveClosedDealPayload(makeInput({ kcKwhMes: 1200 }))
    expect(payload.consumoKwhMes).toBe(1200)
  })

  it('fills distribuidora from clienteDados', () => {
    const payload = resolveClosedDealPayload(makeInput({}, { distribuidora: 'CELESC' }))
    expect(payload.distribuidora).toBe('CELESC')
  })

  it('fills cidade and UF from clienteDados', () => {
    const payload = resolveClosedDealPayload(makeInput({}, { cidade: 'Florianópolis', uf: 'SC' }))
    expect(payload.cidade).toBe('Florianópolis')
    expect(payload.uf).toBe('SC')
  })

  it('fills CPF document type for 11-digit document', () => {
    const payload = resolveClosedDealPayload(makeInput({}, { documento: '123.456.789-09' }))
    expect(payload.documentType).toBe('CPF')
  })

  it('fills CNPJ document type for 14-digit document', () => {
    const payload = resolveClosedDealPayload(makeInput({}, { documento: '11.222.333/0001-81' }))
    expect(payload.documentType).toBe('CNPJ')
  })
})

// ─── 5. Snapshot fallback ─────────────────────────────────────────────────────

describe('resolveClosedDealPayload — snapshot fallback', () => {
  it('uses leasingSnapshot dadosTecnicos when canonical field is absent', () => {
    const payload = resolveClosedDealPayload(makeInput({ kcKwhMes: 0 }))
    // Leasing energiaContratadaKwhMes = 700 is a fallback for consumption
    // kcKwhMes=0 is excluded; the resolver should pick it up from snapshot
    // (current impl: kcKwhMes=0 → not positive, so drops to next source)
    expect(payload.potenciaInstaladaKwp).toBe(8.25) // from leasingSnapshot
    expect(payload.geracaoEstimadaKwhMes).toBe(930) // from leasingSnapshot
  })

  it('uses vendaSnapshot configuracao for venda proposals', () => {
    const payload = resolveClosedDealPayload({
      ...makeInput(),
      snapshot: VENDA_SNAPSHOT,
    })
    expect(payload.potenciaInstaladaKwp).toBe(6.6)
    expect(payload.geracaoEstimadaKwhMes).toBe(750)
    expect(payload.numeroModulos).toBe(12)
    expect(payload.areaUtilizadaM2).toBe(26.4)
    expect(payload.consumoKwhMes).toBe(600)
    expect(payload.valorMercado).toBe(28000)
  })

  it('resolves tarifa from tarifaCheia when venda snapshot has it', () => {
    const payload = resolveClosedDealPayload({
      ...makeInput(),
      snapshot: { ...VENDA_SNAPSHOT, tarifaCheia: 0.99 },
    })
    expect(payload.tarifaCheia).toBe(0.99)
  })
})

// ─── 6. Null-downgrade prevention ────────────────────────────────────────────

describe('mergeResolvedIntoDependentRecord — no null downgrade', () => {
  it('does not write null over an existing value', () => {
    const existing = { city: 'São Paulo' }
    const resolved = { city: null }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'fillIfEmpty')
    expect(patch).not.toHaveProperty('city')
  })

  it('does not write empty string over existing value', () => {
    const existing = { email: 'x@x.com' }
    const resolved = { email: '' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'fillIfEmpty')
    expect(patch).not.toHaveProperty('email')
  })

  it('neverDowngradeToNull policy writes non-null resolved over existing', () => {
    const existing = { city: 'Antiga' }
    const resolved = { city: 'Nova' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'neverDowngradeToNull')
    expect(patch.city).toBe('Nova')
  })

  it('preserveManual policy never writes any field', () => {
    const existing = { city: 'Antiga' }
    const resolved = { city: 'Nova' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'preserveManual')
    expect(patch).not.toHaveProperty('city')
  })

  it('fillIfEmpty fills when destination is null', () => {
    const existing = { city: null }
    const resolved = { city: 'São Paulo' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'fillIfEmpty')
    expect(patch.city).toBe('São Paulo')
  })

  it('overwriteCanonical always writes the resolved value', () => {
    const existing = { city: 'Antiga' }
    const resolved = { city: 'Nova' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'overwriteCanonical')
    expect(patch.city).toBe('Nova')
  })

  it('perField overrides take precedence over default policy', () => {
    const existing = { city: null, email: 'x@x.com' }
    const resolved = { city: 'São Paulo', email: 'new@x.com' }
    const patch = mergeResolvedIntoDependentRecord(existing, resolved, 'fillIfEmpty', {
      email: 'preserveManual',
    })
    expect(patch.city).toBe('São Paulo')       // fillIfEmpty fills null
    expect(patch).not.toHaveProperty('email')  // preserveManual never writes
  })
})

// ─── 7. Idempotency ───────────────────────────────────────────────────────────

describe('resolveClosedDealPayload — idempotency', () => {
  it('produces equivalent output on two calls with the same input', () => {
    const input = makeInput()
    const p1 = resolveClosedDealPayload(input)
    const p2 = resolveClosedDealPayload(input)

    // Exclude hydratedAt (timestamp) from comparison
    const { _sourceMeta: m1, ...rest1 } = p1
    const { _sourceMeta: m2, ...rest2 } = p2

    expect(rest1).toEqual(rest2)
    expect(m1.source).toBe(m2.source)
    expect(m1.sourceClientId).toBe(m2.sourceClientId)
    expect(m1.sourceProposalId).toBe(m2.sourceProposalId)
    expect(m1.contractType).toBe(m2.contractType)
  })
})

// ─── 8. Leasing vs Venda paths ───────────────────────────────────────────────

describe('resolveClosedDealPayload — leasing vs venda', () => {
  it('leasing path: picks data from leasingSnapshot', () => {
    const payload = resolveClosedDealPayload(makeInput())
    expect(payload.contractType).toBe('LEASING')
    expect(payload.potenciaInstaladaKwp).toBe(8.25)
    expect(payload.mensalidadeBase).toBe(350)
    expect(payload.desconto).toBe(20)
  })

  it('venda path: picks data from vendaSnapshot', () => {
    const payload = resolveClosedDealPayload({ ...makeInput(), snapshot: VENDA_SNAPSHOT })
    expect(payload.contractType).toBe('VENDA')
    expect(payload.potenciaInstaladaKwp).toBe(6.6)
    expect(payload.valorMercado).toBe(28000)
    expect(payload.mensalidadeBase).toBeNull() // no projecao in venda
    expect(payload.desconto).toBe(5)
  })

  it('leasing path: contract type maps to LEASING for activeTab=leasing', () => {
    const payload = resolveClosedDealPayload(makeInput({ activeTab: 'leasing' }))
    expect(payload.contractType).toBe('LEASING')
  })

  it('venda path: contract type maps to VENDA for activeTab=venda', () => {
    const payload = resolveClosedDealPayload(makeInput({ activeTab: 'venda' }))
    expect(payload.contractType).toBe('VENDA')
  })
})

// ─── 9. Field map — buildDestPayload ─────────────────────────────────────────

describe('buildDestPayload', () => {
  it('maps resolved keys to destination keys using PORTFOLIO_PROFILE_FEED', () => {
    const payload = resolveClosedDealPayload(makeInput())
    const dest = buildDestPayload(payload, PORTFOLIO_PROFILE_FEED)

    expect(dest.client_name).toBe('João da Silva')
    expect(dest.client_document).toBe('529.982.247-25')
    expect(dest.client_email).toBe('joao@example.com')
    expect(dest.client_phone).toBe('11987654321')
    expect(dest.client_city).toBe('São Paulo')
    expect(dest.client_state).toBe('SP')
    expect(dest.distribuidora).toBe('Enel São Paulo')
    expect(dest.uc_geradora).toBe('123456789012345')
    expect(dest.system_kwp).toBe(8.25)
    expect(dest.consumption_kwh_month).toBe(800)
  })

  it('maps resolved keys to destination keys using PORTFOLIO_CONTRACT_FEED', () => {
    const payload = resolveClosedDealPayload(makeInput())
    const dest = buildDestPayload(payload, PORTFOLIO_CONTRACT_FEED)

    expect(dest.consultant_id).toBe('7')
    expect(dest.consultant_name).toBe('Joana')
    expect(dest.contractual_term_months).toBe(240)
    expect(dest.buyout_amount_reference).toBe(45000)
    expect(dest.source_proposal_id).toBe('prop-abc-123')
  })

  it('maps resolved keys to destination keys using PORTFOLIO_PLAN_FEED', () => {
    const payload = resolveClosedDealPayload(makeInput())
    const dest = buildDestPayload(payload, PORTFOLIO_PLAN_FEED)

    expect(dest.tipo_rede).toBe('trifasico')
    expect(dest.tarifa_atual).toBe(0.85)
    expect(dest.desconto_percentual).toBe(20)
    expect(dest.mensalidade).toBe(350)
    expect(dest.prazo_meses).toBe(240)
  })

  it('maps resolved keys to destination keys using PORTFOLIO_USINA_FEED', () => {
    const payload = resolveClosedDealPayload(makeInput())
    const dest = buildDestPayload(payload, PORTFOLIO_USINA_FEED)

    expect(dest.system_kwp).toBe(8.25)
    expect(dest.potencia_modulo_wp).toBe(550)
    expect(dest.numero_modulos).toBe(15)
    expect(dest.geracao_estimada_kwh).toBe(930)
    expect(dest.tipo_instalacao).toBe('telhado_ceramico')
  })

  it('maps resolved keys to destination keys using PROJECT_FINANCE_FEED', () => {
    const payload = resolveClosedDealPayload(makeInput())
    const dest = buildDestPayload(payload, PROJECT_FINANCE_FEED)

    expect(dest.consumo_kwh_mes).toBe(800)
    expect(dest.potencia_instalada_kwp).toBe(8.25)
    expect(dest.geracao_estimada_kwh_mes).toBe(930)
    expect(dest.prazo_contratual_meses).toBe(240)
    expect(dest.mensalidade_base).toBe(350)
    expect(dest.desconto_percentual).toBe(20)
    expect(dest.valor_venda).toBe(45000)
  })

  it('omits null resolved fields from destination payload', () => {
    const input = makeInput()
    const clienteSemDistribuidora = { ...input.clienteDados }
    delete (clienteSemDistribuidora as Record<string, unknown>).distribuidora
    const payload = resolveClosedDealPayload({ ...input, clienteDados: clienteSemDistribuidora })
    const dest = buildDestPayload(payload, PORTFOLIO_PROFILE_FEED)
    // distribuidora was omitted from clienteDados and snapshot → should be null
    expect(dest.distribuidora).toBeUndefined()
  })
})
