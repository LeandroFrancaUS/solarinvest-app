/**
 * src/services/deals/__tests__/convert-client-to-closed-deal.test.ts
 *
 * Integration tests for the "Negócio Fechado" orchestrator
 * (`convertClientToClosedDeal`).
 *
 * Covers the 10 scenarios required by the spec:
 *   1. Fresh client → creates portfolio + project + finance seed.
 *   2. Re-running with the same clientId does not duplicate (single calls
 *      to upsert endpoints).
 *   3. Manual value on destination is preserved (existing client_phone is
 *      not overwritten by the resolved value).
 *   4. `null`/empty resolved values never appear in any patch.
 *   5. consultant_id never downgrades to null when one is already saved.
 *   6. linked_client_id (== clientId) remains consistent across runs.
 *   7. Project finance seed contains the minimum inputs the engine needs.
 *   8. LEASING path → contract_type === 'leasing' / 'leasing'.
 *   9. VENDA path → contract_type === 'sale' / 'venda'.
 *  10. Null contractType → financial steps skipped, conversion fails loudly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolveClosedDealPayloadInput } from '../../../domain/conversion/resolve-closed-deal-payload'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../clientPortfolioApi', () => ({
  exportClientToPortfolio: vi.fn().mockResolvedValue(undefined),
  fetchPortfolioClient: vi.fn().mockResolvedValue(null),
  patchPortfolioProfile: vi.fn().mockResolvedValue(undefined),
  patchPortfolioContract: vi.fn().mockResolvedValue(99),
  patchPortfolioPlan: vi.fn().mockResolvedValue(undefined),
  patchPortfolioUsina: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../projectsApi', () => ({
  createProjectFromContract: vi
    .fn()
    .mockResolvedValue({ project: { id: 'proj-001' }, created: true }),
}))

vi.mock('../../../features/project-finance/api', () => ({
  fetchProjectFinance: vi.fn().mockResolvedValue({ profile: null }),
  saveProjectFinance: vi.fn().mockResolvedValue({}),
}))

// Imports must come AFTER the vi.mock calls.
import {
  exportClientToPortfolio,
  fetchPortfolioClient,
  patchPortfolioProfile,
  patchPortfolioContract,
  patchPortfolioPlan,
  patchPortfolioUsina,
} from '../../clientPortfolioApi'
import { createProjectFromContract } from '../../projectsApi'
import {
  fetchProjectFinance,
  saveProjectFinance,
} from '../../../features/project-finance/api'
import { convertClientToClosedDeal } from '../convert-client-to-closed-deal'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT: ResolveClosedDealPayloadInput = {
  clientId: 42,
  proposalId: 'prop-abc-123',
  clienteDados: {
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
    consultorId: '7',
  },
  snapshot: {
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
  },
  consultants: [
    { id: 7, apelido: 'Joana', full_name: 'Joana Ferreira', email: 'joana@solar.com' },
  ],
  ucBeneficiarias: ['678901234567890'],
}

const VENDA_INPUT: ResolveClosedDealPayloadInput = {
  ...BASE_INPUT,
  snapshot: {
    activeTab: 'venda',
    kcKwhMes: 600,
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
      composicao: { venda_total: 28000, desconto_percentual: 5 },
      parametros: { consumo_kwh_mes: 600, tarifa_r_kwh: 0.92 },
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-establish default resolved values after clearAllMocks() resets them.
  vi.mocked(exportClientToPortfolio).mockResolvedValue(undefined)
  vi.mocked(fetchPortfolioClient).mockResolvedValue(null)
  vi.mocked(patchPortfolioProfile).mockResolvedValue(undefined)
  vi.mocked(patchPortfolioContract).mockResolvedValue(99)
  vi.mocked(patchPortfolioPlan).mockResolvedValue(undefined)
  vi.mocked(patchPortfolioUsina).mockResolvedValue(undefined)
  vi.mocked(createProjectFromContract).mockResolvedValue({
    project: {
      id: 'proj-001',
      // Cast: the test mock only needs `id`; the orchestrator never reads other
      // fields, so we keep the fixture minimal.
    } as unknown as Awaited<ReturnType<typeof createProjectFromContract>>['project'],
    created: true,
  })
  vi.mocked(fetchProjectFinance).mockResolvedValue({
    profile: null,
    contract_type: 'leasing',
    contract_term_months: null,
    mensalidade_base: null,
    project_id: 'proj-001',
  })
  vi.mocked(saveProjectFinance).mockResolvedValue(
    {} as unknown as Awaited<ReturnType<typeof saveProjectFinance>>,
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─── 1. Fresh client → full hydration ─────────────────────────────────────────

describe('convertClientToClosedDeal — fresh client', () => {
  it('exports the client and hydrates portfolio + project + finance', async () => {
    const result = await convertClientToClosedDeal(BASE_INPUT)

    expect(result.ok).toBe(true)
    expect(exportClientToPortfolio).toHaveBeenCalledWith(42)
    expect(patchPortfolioProfile).toHaveBeenCalledTimes(1)
    expect(patchPortfolioContract).toHaveBeenCalledTimes(1)
    expect(patchPortfolioPlan).toHaveBeenCalledTimes(1)
    expect(patchPortfolioUsina).toHaveBeenCalledTimes(1)
    expect(createProjectFromContract).toHaveBeenCalledWith(99)
    expect(saveProjectFinance).toHaveBeenCalledTimes(1)

    const stepsOk = result.steps.filter((s) => s.ok).map((s) => s.step)
    expect(stepsOk).toEqual(
      expect.arrayContaining([
        'portfolio-export',
        'portfolio-profile',
        'portfolio-usina',
        'portfolio-plan',
        'portfolio-contract',
        'financial-project',
        'financial-profile',
      ]),
    )
  })
})

// ─── 2. Idempotency — re-running does not duplicate ───────────────────────────

describe('convertClientToClosedDeal — idempotency', () => {
  it('running twice with the same clientId hits each upsert endpoint once per run, never creates duplicates', async () => {
    await convertClientToClosedDeal(BASE_INPUT)

    // Second run with same clientId: server-side endpoints are upsert-by-id.
    // Reset the call history but keep mocks alive.
    vi.mocked(exportClientToPortfolio).mockClear()
    vi.mocked(patchPortfolioContract).mockClear()
    vi.mocked(createProjectFromContract).mockClear()

    await convertClientToClosedDeal(BASE_INPUT)

    expect(exportClientToPortfolio).toHaveBeenCalledTimes(1)
    expect(exportClientToPortfolio).toHaveBeenCalledWith(42)
    expect(patchPortfolioContract).toHaveBeenCalledTimes(1)
    // The contract endpoint is upsert-by-clientId; assert clientId is stable.
    expect(patchPortfolioContract).toHaveBeenCalledWith(42, expect.any(Object))
    expect(createProjectFromContract).toHaveBeenCalledTimes(1)
    // Same contractId → same project (idempotent on the server side).
    expect(createProjectFromContract).toHaveBeenCalledWith(99)
  })
})

// ─── 3. Manual value preserved ────────────────────────────────────────────────

describe('convertClientToClosedDeal — preserves manual edits', () => {
  it('does not overwrite a client_phone that is already set on the portfolio row', async () => {
    vi.mocked(fetchPortfolioClient).mockResolvedValueOnce({
      // Manually entered phone — must not be overwritten.
      phone: '+55 99 99999-0000',
      client_phone: '+55 99 99999-0000',
      // Empty fields the orchestrator may fill.
      email: null,
      city: null,
    } as unknown as Awaited<ReturnType<typeof fetchPortfolioClient>>)

    await convertClientToClosedDeal(BASE_INPUT)

    expect(patchPortfolioProfile).toHaveBeenCalledTimes(1)
    const [, patch] = vi.mocked(patchPortfolioProfile).mock.calls[0]!
    // client_phone must NOT be in the patch (existing manual value is preserved).
    expect(patch).not.toHaveProperty('client_phone')
    // Other empty fields should still be filled.
    expect(patch).toHaveProperty('client_email', 'joao@example.com')
  })
})

// ─── 4. null resolved values never appear in any patch ────────────────────────

describe('convertClientToClosedDeal — null values never sent', () => {
  it('omits any key whose resolved value is null/undefined/empty', async () => {
    // Strip optional fields to force several resolved-payload keys to null.
    const minimal: ResolveClosedDealPayloadInput = {
      ...BASE_INPUT,
      clienteDados: {
        nome: 'Min',
        documento: '529.982.247-25',
        // No email, no telefone, no cidade, etc.
      },
      snapshot: { activeTab: 'leasing' },
    }

    await convertClientToClosedDeal(minimal)

    expect(patchPortfolioProfile).toHaveBeenCalledTimes(1)
    const [, patch] = vi.mocked(patchPortfolioProfile).mock.calls[0]!
    // Iterate every patch entry and assert no null/undefined/empty-string slipped through.
    for (const [k, v] of Object.entries(patch)) {
      expect(v, `field ${k} should not be null/undefined/empty`).not.toBeNull()
      expect(v, `field ${k} should not be undefined`).not.toBeUndefined()
      if (typeof v === 'string') {
        expect(v.trim().length, `field ${k} should not be empty`).toBeGreaterThan(0)
      }
    }
  })
})

// ─── 5. consultant_id never downgrades to null ────────────────────────────────

describe('convertClientToClosedDeal — consultant_id never downgrades', () => {
  it('keeps the existing consultant_id even when the resolved consultantId is null', async () => {
    vi.mocked(fetchPortfolioClient).mockResolvedValueOnce({
      consultant_id: 'existing-consultant-9',
    } as unknown as Awaited<ReturnType<typeof fetchPortfolioClient>>)

    // Force resolved.consultantId to null by removing consultorId and consultants.
    const noConsultant: ResolveClosedDealPayloadInput = {
      ...BASE_INPUT,
      clienteDados: { ...BASE_INPUT.clienteDados, consultorId: null },
      consultants: [],
    }

    await convertClientToClosedDeal(noConsultant)

    expect(patchPortfolioContract).toHaveBeenCalledTimes(1)
    const [, contractPatch] = vi.mocked(patchPortfolioContract).mock.calls[0]!
    // Resolved consultantId is null → the merge helper's global null-guard
    // strips the key entirely, so consultant_id never appears in the patch.
    // The server-side COALESCE then keeps the existing value.
    expect(contractPatch).not.toHaveProperty('consultant_id')
  })

  it('preserves existing consultant_id when a different consultantId is resolved', async () => {
    vi.mocked(fetchPortfolioClient).mockResolvedValueOnce({
      consultant_id: 'manual-consultant-xyz',
    } as unknown as Awaited<ReturnType<typeof fetchPortfolioClient>>)

    await convertClientToClosedDeal(BASE_INPUT)

    expect(patchPortfolioContract).toHaveBeenCalledTimes(1)
    const [, contractPatch] = vi.mocked(patchPortfolioContract).mock.calls[0]!
    // Per perFieldPolicy ('preserveManual' on consultant_id when one exists),
    // the patch must not contain consultant_id at all.
    expect(contractPatch).not.toHaveProperty('consultant_id')
  })
})

// ─── 6. linked_client_id consistency ──────────────────────────────────────────

describe('convertClientToClosedDeal — linked_client_id consistency', () => {
  it('passes the same numeric clientId to every dependent API across runs', async () => {
    await convertClientToClosedDeal(BASE_INPUT)
    await convertClientToClosedDeal(BASE_INPUT)

    const allClientIdArgs = [
      ...vi.mocked(exportClientToPortfolio).mock.calls.map((c) => c[0]),
      ...vi.mocked(patchPortfolioProfile).mock.calls.map((c) => c[0]),
      ...vi.mocked(patchPortfolioContract).mock.calls.map((c) => c[0]),
      ...vi.mocked(patchPortfolioPlan).mock.calls.map((c) => c[0]),
      ...vi.mocked(patchPortfolioUsina).mock.calls.map((c) => c[0]),
    ]
    for (const id of allClientIdArgs) {
      expect(id).toBe(42)
    }
  })
})

// ─── 7. Project finance seed contains minimum engine inputs ───────────────────

describe('convertClientToClosedDeal — finance engine minimum inputs', () => {
  it('seeds the project finance profile with consumo, potência, geração, prazo, contract_type and client_id', async () => {
    await convertClientToClosedDeal(BASE_INPUT)

    expect(saveProjectFinance).toHaveBeenCalledTimes(1)
    const [projectId, form] = vi.mocked(saveProjectFinance).mock.calls[0]!
    expect(projectId).toBe('proj-001')

    // Minimum keys the Financeiro engine needs to compute on its own.
    expect(form).toMatchObject({
      contract_type: 'leasing',
      consumo_kwh_mes: 800,
      potencia_instalada_kwp: 8.25,
      geracao_estimada_kwh_mes: 930,
      prazo_contratual_meses: 240,
      mensalidade_base: 350,
      desconto_percentual: 20,
      valor_venda: 45000,
      client_id: 42,
      snapshot_source: 'closed_deal_conversion',
    })
    // Module wattage is forwarded via technical_params_json (not a top-level column).
    expect(form.technical_params_json).toMatchObject({
      potencia_modulo_wp: 550,
    })
  })
})

// ─── 8 & 9. LEASING / VENDA contract_type routing ─────────────────────────────

describe('convertClientToClosedDeal — contract_type routing', () => {
  it('LEASING: contract_type=leasing on portfolio + leasing on project finance', async () => {
    await convertClientToClosedDeal(BASE_INPUT)

    const [, contractPatch] = vi.mocked(patchPortfolioContract).mock.calls[0]!
    expect(contractPatch.contract_type).toBe('leasing')

    const [, financeForm] = vi.mocked(saveProjectFinance).mock.calls[0]!
    expect(financeForm.contract_type).toBe('leasing')
  })

  it('VENDA: contract_type=sale on portfolio + venda on project finance', async () => {
    await convertClientToClosedDeal(VENDA_INPUT)

    const [, contractPatch] = vi.mocked(patchPortfolioContract).mock.calls[0]!
    expect(contractPatch.contract_type).toBe('sale')

    const [, financeForm] = vi.mocked(saveProjectFinance).mock.calls[0]!
    expect(financeForm.contract_type).toBe('venda')
  })
})

// ─── 10. Null contractType → fail loudly, no project creation ─────────────────

describe('convertClientToClosedDeal — null contractType safety', () => {
  it('aborts the conversion before contract/project creation when contract type cannot be determined', async () => {
    // Patch the resolver path: an input with no leasing/venda evidence at all
    // still resolves to a contractType ('LEASING' is the default in the
    // resolver because mapProposalDataToPortfolioFields defaults to 'leasing').
    // To force null, we monkey-patch the resolver via a local input that
    // bypasses both branches: spy on resolveClosedDealPayload through dynamic
    // import is overkill, so instead force null by mocking the resolver.
    const resolverModule = await import(
      '../../../domain/conversion/resolve-closed-deal-payload'
    )
    const spy = vi
      .spyOn(resolverModule, 'resolveClosedDealPayload')
      .mockImplementation((input) => ({
        clientId: String(input.clientId),
        proposalId: input.proposalId ?? null,
        contractType: null,
        consultantId: null,
        consultantLabel: null,
        nome: null,
        nomeRazao: null,
        cpfCnpj: null,
        documentType: null,
        telefone: null,
        telefoneSecundario: null,
        email: null,
        cidade: null,
        uf: null,
        cep: null,
        endereco: null,
        bairro: null,
        numero: null,
        complemento: null,
        distribuidora: null,
        ucGeradora: null,
        ucBeneficiaria: null,
        tipoRede: null,
        tipoInstalacao: null,
        consumoKwhMes: null,
        geracaoEstimadaKwhMes: null,
        potenciaModuloWp: null,
        numeroModulos: null,
        potenciaInstaladaKwp: null,
        areaUtilizadaM2: null,
        modeloModulo: null,
        modeloInversor: null,
        tarifaCheia: null,
        prazoMeses: null,
        valorMercado: null,
        desconto: null,
        mensalidadeBase: null,
        ownerUserId: null,
        createdByUserId: null,
        _sourceMeta: {
          source: 'closed_deal_conversion',
          hydratedAt: '2026-01-01T00:00:00.000Z',
          hydratedVersion: '1',
          contractType: null,
          sourceProposalId: null,
          sourceClientId: String(input.clientId),
        },
      }))

    try {
      const result = await convertClientToClosedDeal(BASE_INPUT)

      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Tipo de contrato/)
      // Contract upsert MUST NOT have been called.
      expect(patchPortfolioContract).not.toHaveBeenCalled()
      // No project created.
      expect(createProjectFromContract).not.toHaveBeenCalled()
      expect(saveProjectFinance).not.toHaveBeenCalled()
      // Steps include explicit failures for the financial path.
      const failed = result.steps.filter((s) => !s.ok).map((s) => s.step)
      expect(failed).toEqual(
        expect.arrayContaining(['portfolio-contract', 'financial-project', 'financial-profile']),
      )
    } finally {
      spy.mockRestore()
    }
  })
})
