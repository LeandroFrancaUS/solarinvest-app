/**
 * Pure client-state helper functions and constants.
 * Extracted from App.tsx to reduce its size.
 *
 * Rules:
 * - No React imports here (pure functions / constants only)
 * - No side effects on module load
 * - No direct DB / API access
 * - No business-logic duplication
 */

import type { ClienteDados, PrintableProposalTipo } from '../../types/printableProposal'
import type { FieldSyncKey } from '../../store/useFieldSyncStore'
import type { KitBudgetState } from '../../app/config'
import type { VendasConfig } from '../../types/vendasConfig'
import type { VendaForm } from '../../lib/finance/roi'
import type { ParsedVendaPdfData } from '../../lib/pdf/extractVendas'
import type { VendaSnapshot } from '../../store/useVendaStore'
import type { LeasingState } from '../../store/useLeasingStore'
import type { ClientRow } from '../../lib/api/clientsApi'
import { toNumberFlexible } from '../../lib/locale/br-number'
import { formatCep } from '../../utils/formatters'
import { getDistribuidoraDefaultForUf } from '../../utils/distribuidoraHelpers'
import type {
  ClienteRegistro,
  ClientsSyncState,
  ClientsSource,
  OrcamentoSnapshotData,
  PersistedClientReconciliation,
  PageSharedSettings,
} from '../../types/orcamentoTypes'
import type { TipoRede } from '../../app/config'

// Re-export so consumers only need one import location
export type {
  ClienteRegistro,
  ClientsSyncState,
  ClientsSource,
  OrcamentoSnapshotData,
  PersistedClientReconciliation,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const CLIENTES_STORAGE_KEY = 'solarinvest-clientes'
export const CLIENTS_RECONCILIATION_KEY = 'clients-reconciliation-v1'
export const CONSULTORES_CACHE_KEY = 'solarinvest-consultores-cache'
export const CLIENT_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-client-server-id-map'

// ---------------------------------------------------------------------------
// ID generation constants
// ---------------------------------------------------------------------------

export const CLIENTE_ID_LENGTH = 5
export const CLIENTE_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const CLIENTE_ID_PATTERN = /^[A-Z0-9]{5}$/
export const CLIENTE_ID_MAX_ATTEMPTS = 10000

// ---------------------------------------------------------------------------
// Default empty ClienteDados
// ---------------------------------------------------------------------------

export const CLIENTE_INICIAL: ClienteDados = {
  nome: '',
  documento: '',
  rg: '',
  estadoCivil: '',
  nacionalidade: '',
  profissao: '',
  representanteLegal: '',
  email: '',
  telefone: '',
  cep: '',
  distribuidora: '',
  uc: '',
  endereco: '',
  cidade: 'Anápolis',
  uf: 'GO',
  temIndicacao: false,
  indicacaoNome: '',
  consultorId: '',
  consultorNome: '',
  herdeiros: [''],
  nomeSindico: '',
  cpfSindico: '',
  contatoSindico: '',
  diaVencimento: '10',
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

export const isSyncedClienteField = (key: keyof ClienteDados): key is FieldSyncKey =>
  key === 'uf' || key === 'cidade' || key === 'distribuidora' || key === 'cep' || key === 'endereco'

export const normalizeDistribuidoraName = (value?: string | null): string =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase() ?? ''

export const getDistribuidoraValidationMessage = (
  ufRaw?: string | null,
  distribuidoraRaw?: string | null,
): string | null => {
  const uf = ufRaw?.trim().toUpperCase() ?? ''
  const distribuidora = distribuidoraRaw?.trim() ?? ''
  const expected = getDistribuidoraDefaultForUf(uf)
  const distribuidoraNormalizada = normalizeDistribuidoraName(distribuidora)
  const expectedNormalizada = normalizeDistribuidoraName(expected)

  if (!uf && distribuidora) {
    return 'Informe a UF antes de definir a distribuidora.'
  }

  if (expected) {
    if (!distribuidora) {
      return `Informe a distribuidora para a UF ${uf}. Sugestão: ${expected}.`
    }
    if (distribuidoraNormalizada !== expectedNormalizada) {
      return `Distribuidora incompatível com a UF ${uf}. Use ${expected}.`
    }
    return null
  }

  if (uf && !distribuidora) {
    return 'Informe a distribuidora para a UF selecionada.'
  }

  return null
}

// ---------------------------------------------------------------------------
// Herdeiros helpers
// ---------------------------------------------------------------------------

export const ensureClienteHerdeiros = (valor: unknown): string[] => {
  if (Array.isArray(valor)) {
    if (valor.length === 0) {
      return ['']
    }
    return valor.map((item) => (typeof item === 'string' ? item : ''))
  }
  return ['']
}

export const normalizeClienteHerdeiros = (valor: unknown): string[] => {
  if (Array.isArray(valor)) {
    const normalizados = valor.map((item) =>
      typeof item === 'string' ? item.trim() : '',
    )
    return normalizados.length > 0 ? normalizados : ['']
  }

  if (typeof valor === 'string') {
    const trimmed = valor.trim()
    return trimmed ? [trimmed] : ['']
  }

  return ['']
}

// ---------------------------------------------------------------------------
// ClienteDados clone
// ---------------------------------------------------------------------------

export const cloneClienteDados = (dados: ClienteDados): ClienteDados => ({
  ...CLIENTE_INICIAL,
  ...dados,
  herdeiros: ensureClienteHerdeiros(dados.herdeiros),
})

// ---------------------------------------------------------------------------
// Client ID generation
// ---------------------------------------------------------------------------

export const normalizeClienteIdCandidate = (valor: string | undefined | null) =>
  (valor ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

export const generateClienteId = (existingIds: Set<string> = new Set()) => {
  let attempts = 0

  while (attempts < CLIENTE_ID_MAX_ATTEMPTS) {
    attempts += 1
    let candidate = ''
    for (let index = 0; index < CLIENTE_ID_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * CLIENTE_ID_CHARSET.length)
      candidate += CLIENTE_ID_CHARSET[randomIndex]
    }

    if (!existingIds.has(candidate)) {
      existingIds.add(candidate)
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um identificador único para o cliente.')
}

export const ensureClienteId = (candidate: string | undefined, existingIds: Set<string>) => {
  const normalized = normalizeClienteIdCandidate(candidate)
  if (
    normalized.length === CLIENTE_ID_LENGTH &&
    CLIENTE_ID_PATTERN.test(normalized) &&
    !existingIds.has(normalized)
  ) {
    existingIds.add(normalized)
    return normalized
  }

  return generateClienteId(existingIds)
}

// ---------------------------------------------------------------------------
// Storage quota helpers
// ---------------------------------------------------------------------------

export const isQuotaExceededError = (error: unknown) => {
  if (!error) {
    return false
  }

  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    )
  }

  if (error instanceof Error) {
    return /quota|storage/i.test(error.message)
  }

  return false
}

export const persistWithFallback = <T,>(
  key: string,
  registros: T[],
  options: {
    serialize: (items: T[]) => string
    reduce: (items: T[]) => T[] | null
  },
): { persisted: T[]; droppedCount: number } => {
  if (typeof window === 'undefined') {
    return { persisted: registros, droppedCount: 0 }
  }

  if (registros.length === 0) {
    window.localStorage.removeItem(key)
    return { persisted: [], droppedCount: 0 }
  }

  const working = [...registros]
  let droppedCount = 0
  let lastError: unknown = null

  while (working.length >= 0) {
    try {
      if (working.length === 0) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, options.serialize(working))
      }
      return { persisted: working, droppedCount }
    } catch (error) {
      lastError = error
      if (!isQuotaExceededError(error)) {
        throw error
      }

      const next = options.reduce(working)
      if (!next) {
        break
      }
      droppedCount += Math.max(0, working.length - next.length)
      working.splice(0, working.length, ...next)
    }
  }

  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError as unknown as string))
  }

  throw new Error('Falha ao salvar orçamentos no armazenamento local.')
}

// ---------------------------------------------------------------------------
// Snapshot strip/serialize helpers
// ---------------------------------------------------------------------------

/**
 * Strip large/reconstructable fields from a snapshot before writing it to
 * localStorage or sending to /api/storage.  Returns a partial copy that
 * preserves only the data that matters for offline recovery.
 */
export const stripSnapshotForStorage = (
  snapshot: OrcamentoSnapshotData | null | undefined,
): OrcamentoSnapshotData | undefined => {
  if (!snapshot) return undefined
  const stripped: Partial<OrcamentoSnapshotData> = {
    ...snapshot,
    parsedVendaPdf: null,
    propostaImagens: [],
    budgetStructuredItems: [],
    kitBudget: snapshot.kitBudget
      ? {
          ...snapshot.kitBudget,
          items: [],
          missingInfo: null,
          warnings: [],
        }
      : ({} as KitBudgetState),
    budgetProcessing: {
      isProcessing: false,
      error: null,
      progress: null,
      isTableCollapsed: false,
      ocrDpi: 150,
    },
    vendasSimulacoes: {},
    ufsDisponiveis: [],
    distribuidorasPorUf: {},
  }
  return stripped as OrcamentoSnapshotData
}

/**
 * Serialize a list of client records for localStorage / remote storage.
 * Strips heavy snapshot fields so the payload stays within quota limits.
 */
export function serializeClientesForStorage(registros: ClienteRegistro[]): string {
  const lite = registros.map((r) => ({
    ...r,
    propostaSnapshot: stripSnapshotForStorage(r.propostaSnapshot),
  }))
  return JSON.stringify(lite)
}

export const persistClientesToLocalStorage = (
  registros: ClienteRegistro[],
): { persisted: ClienteRegistro[]; droppedCount: number } => {
  let strippedSnapshots = false
  return persistWithFallback(CLIENTES_STORAGE_KEY, registros, {
    serialize: (items) => (strippedSnapshots ? JSON.stringify(items) : serializeClientesForStorage(items)),
    reduce: (items) => {
      if (!strippedSnapshots) {
        strippedSnapshots = true
        return items.map((registro) => {
          const { propostaSnapshot: _propostaSnapshot, ...rest } = registro
          return rest as ClienteRegistro
        })
      }
      return items.slice(0, -1)
    },
  })
}

// ---------------------------------------------------------------------------
// normalizeClienteRegistros
// Uses JSON-based deep clone for snapshot data (safe and dependency-free).
// ---------------------------------------------------------------------------

type NormalizeClienteRegistrosOptions = {
  existingIds?: Set<string>
  agoraIso?: string
}

export const normalizeClienteRegistros = (
  items: unknown[],
  options: NormalizeClienteRegistrosOptions = {},
): { registros: ClienteRegistro[]; houveAtualizacaoIds: boolean } => {
  const agora = options.agoraIso ?? new Date().toISOString()
  const baseExistingIds = options.existingIds ? Array.from(options.existingIds) : []
  const existingIds = new Set<string>(baseExistingIds)
  let houveAtualizacaoIds = false
  let snapshotWarnedInBatch = false

  const normalizados = items.map((item) => {
    const registro = item as Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> }
    const dados = registro.dados ?? (registro as unknown as { cliente?: Partial<ClienteDados> }).cliente ?? {}
    const rawId = (registro.id ?? '').toString()
    const sanitizedCandidate = normalizeClienteIdCandidate(rawId)
    const idNormalizado = ensureClienteId(rawId, existingIds)
    if (idNormalizado !== sanitizedCandidate || rawId.trim() !== idNormalizado) {
      houveAtualizacaoIds = true
    }

    const temIndicacaoRaw = (dados as { temIndicacao?: unknown }).temIndicacao
    const indicacaoNomeRaw = (dados as { indicacaoNome?: unknown }).indicacaoNome
    const temIndicacaoNormalizado =
      typeof temIndicacaoRaw === 'boolean'
        ? temIndicacaoRaw
        : typeof temIndicacaoRaw === 'string'
        ? ['1', 'true', 'sim'].includes(temIndicacaoRaw.trim().toLowerCase())
        : false
    const indicacaoNomeNormalizado =
      typeof indicacaoNomeRaw === 'string' ? indicacaoNomeRaw.trim() : ''

    const herdeirosNormalizados = normalizeClienteHerdeiros(
      (dados as { herdeiros?: unknown }).herdeiros,
    )

    let propostaSnapshot: OrcamentoSnapshotData | undefined
    const snapshotRaw =
      (registro as { propostaSnapshot?: unknown }).propostaSnapshot ??
      (registro as { snapshot?: unknown }).snapshot
    if (snapshotRaw && typeof snapshotRaw === 'object') {
      try {
        propostaSnapshot = JSON.parse(JSON.stringify(snapshotRaw)) as OrcamentoSnapshotData
      } catch (error) {
        if (!snapshotWarnedInBatch) {
          snapshotWarnedInBatch = true
          console.warn(
            `Não foi possível normalizar o snapshot do cliente (id: ${idNormalizado}). Os dados do cliente foram preservados.`,
            error,
          )
        }
        propostaSnapshot = undefined
      }
    }

    const normalizado: ClienteRegistro = {
      id: idNormalizado,
      criadoEm: registro.criadoEm ?? agora,
      atualizadoEm: registro.atualizadoEm ?? registro.criadoEm ?? agora,
      dados: {
        nome: dados?.nome ?? '',
        documento: dados?.documento ?? '',
        rg: dados?.rg ?? '',
        estadoCivil: dados?.estadoCivil ?? '',
        nacionalidade: dados?.nacionalidade ?? '',
        profissao: dados?.profissao ?? '',
        representanteLegal: dados?.representanteLegal ?? '',
        email: dados?.email ?? '',
        telefone: dados?.telefone ?? '',
        cep: dados?.cep ?? '',
        distribuidora: dados?.distribuidora ?? '',
        uc: dados?.uc ?? '',
        endereco: dados?.endereco ?? '',
        cidade: dados?.cidade ?? '',
        uf: dados?.uf ?? '',
        temIndicacao: temIndicacaoNormalizado,
        indicacaoNome: temIndicacaoNormalizado ? indicacaoNomeNormalizado : '',
        nomeSindico: dados?.nomeSindico ?? '',
        cpfSindico: dados?.cpfSindico ?? '',
        contatoSindico: dados?.contatoSindico ?? '',
        diaVencimento: dados?.diaVencimento ?? '10',
        herdeiros: herdeirosNormalizados,
        consultorId: dados?.consultorId ?? '',
        consultorNome: dados?.consultorNome ?? '',
      },
      ...(propostaSnapshot ? { propostaSnapshot } : {}),
    }

    return normalizado
  })

  const ordenados = normalizados.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

  return { registros: ordenados, houveAtualizacaoIds }
}

// ---------------------------------------------------------------------------
// serverClientToRegistro
// Maps a server-side ClientRow to the local ClienteRegistro format.
// ---------------------------------------------------------------------------

export function serverClientToRegistro(row: ClientRow): ClienteRegistro {
  const ownerName = row.owner_display_name ?? row.owner_email ?? row.owner_user_id
  const ownerEmail = row.owner_email
  const ownerUserId = row.owner_user_id
  const ep = row.energy_profile
  const lp = row.latest_proposal_profile

  const meta = row.metadata ?? {}
  const metaTemIndicacao = meta.tem_indicacao as boolean | undefined
  const metaIndicacaoNome = (meta.indicacao_nome as string | undefined)?.trim() || ''
  const hasIndicacao = metaTemIndicacao != null
    ? metaTemIndicacao
    : Boolean(lp?.tem_indicacao || lp?.indicacao?.trim() || ep?.indicacao?.trim())
  const indicacaoNome = metaIndicacaoNome || lp?.indicacao?.trim() || ep?.indicacao?.trim() || ''
  const validTipoRede: TipoRede[] = ['monofasico', 'bifasico', 'trifasico', 'nenhum']
  const resolvedTipoRede: TipoRede =
    lp?.tipo_rede && validTipoRede.includes(lp.tipo_rede as TipoRede)
      ? (lp.tipo_rede as TipoRede)
      : ep?.tipo_rede && validTipoRede.includes(ep.tipo_rede as TipoRede)
        ? (ep.tipo_rede as TipoRede)
        : 'nenhum'
  const resolvedModalidade =
    ep?.modalidade === 'venda' ? ('vendas' as const) : ('leasing' as const)
  const parsePositiveConsumption = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    if (typeof value === 'string') {
      const parsed = toNumberFlexible(value)
      if (Number.isFinite(parsed) && parsed !== null && parsed > 0) return parsed
    }
    return null
  }
  const resolvedKwhContratado = (
    parsePositiveConsumption(row.consumption_kwh_month)
    ?? parsePositiveConsumption(lp?.kwh_contratado)
    ?? parsePositiveConsumption(ep?.kwh_contratado)
  )
  const resolvedTarifaAtual = lp?.tarifa_atual ?? ep?.tarifa_atual ?? null
  const resolvedDesconto = lp?.desconto_percentual ?? ep?.desconto_percentual ?? null
  const resolvedUcsBeneficiarias = Array.isArray(lp?.ucs_beneficiarias) ? lp.ucs_beneficiarias : []

  const dados: ClienteDados = {
    nome: row.name,
    apelido: (meta.apelido as string | undefined) ?? '',
    documento: row.document ?? row.cpf_raw ?? row.cnpj_raw ?? '',
    rg: (meta.rg as string | undefined) ?? '',
    estadoCivil: (meta.estado_civil as string | undefined) ?? '',
    nacionalidade: (meta.nacionalidade as string | undefined) ?? '',
    profissao: (meta.profissao as string | undefined) ?? '',
    representanteLegal: (meta.representante_legal as string | undefined) ?? '',
    email: row.email ?? '',
    telefone: row.phone ?? '',
    cep: formatCep(row.cep ?? ''),
    distribuidora: row.distribuidora ?? '',
    uc: row.uc ?? '',
    endereco: row.address ?? '',
    cidade: row.city ?? '',
    uf: row.state ?? '',
    temIndicacao: hasIndicacao,
    indicacaoNome: hasIndicacao ? indicacaoNome : '',
    consultorId: (() => {
      const canonical = row.consultant_id != null && row.consultant_id !== '' ? String(row.consultant_id).trim() : ''
      if (canonical) {
        console.debug('[consultant][hydrate]', { clientId: row.id, source: 'canonical', consultantId: canonical })
        return canonical
      }
      const legacyId = (meta.consultor_id as string | number | undefined)
      if (legacyId != null && legacyId !== '') {
        const legacyStr = String(legacyId).trim()
        console.debug('[consultant][hydrate]', { clientId: row.id, source: 'legacy-metadata', consultantId: legacyStr })
        return legacyStr
      }
      console.debug('[consultant][hydrate]', { clientId: row.id, source: 'none', canonicalNull: row.consultant_id, legacyMetadata: meta.consultor_id })
      return ''
    })(),
    consultorNome: (meta.consultor_nome as string | undefined) ?? '',
    herdeiros: (() => {
      if (!Array.isArray(meta.herdeiros)) return ['']
      const filtered = (meta.herdeiros as string[]).filter((h) => typeof h === 'string' && h.trim())
      return filtered.length > 0 ? filtered : ['']
    })(),
    nomeSindico: (meta.nome_sindico as string | undefined) ?? '',
    cpfSindico: (meta.cpf_sindico as string | undefined) ?? '',
    contatoSindico: (meta.contato_sindico as string | undefined) ?? '',
    diaVencimento: (meta.dia_vencimento as string | undefined) ?? '10',
  }

  const leasingPrazo = ep?.prazo_meses != null ? Math.round(ep.prazo_meses / 12) : 20

  const propostaSnapshot: OrcamentoSnapshotData | undefined = (ep || lp)
    ? ({
        activeTab: resolvedModalidade,
        settingsTab: 'painel',
        cliente: dados,
        clienteEmEdicaoId: row.id,
        clienteMensagens: {},
        ucBeneficiarias: resolvedUcsBeneficiarias.map((item, index) => ({
          id: item.id ?? `lp-uc-${index + 1}`,
          numero: typeof item.numero === 'string' ? item.numero : '',
          endereco: typeof item.endereco === 'string' ? item.endereco : '',
          consumoKWh: String(item.consumoKWh ?? ''),
          rateioPercentual: String(item.rateioPercentual ?? ''),
        })),
        pageShared: { procuracao: { uf: row.state ?? '', cidade: row.city ?? '' } } as unknown as PageSharedSettings,
        currentBudgetId: '',
        budgetStructuredItems: [],
        kitBudget: null,
        budgetProcessing: { isProcessing: false, error: null, progress: null, isTableCollapsed: false, ocrDpi: 150 },
        propostaImagens: [],
        ufTarifa: row.state ?? '',
        distribuidoraTarifa: row.distribuidora ?? '',
        ufsDisponiveis: [],
        distribuidorasPorUf: {},
        mesReajuste: 1,
        kcKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
        consumoManual: resolvedKwhContratado != null && resolvedKwhContratado > 0,
        tarifaCheia: resolvedTarifaAtual != null ? Number(resolvedTarifaAtual) : 0,
        desconto: resolvedDesconto != null ? Number(resolvedDesconto) : 0,
        taxaMinima: 0,
        taxaMinimaInputEmpty: false,
        encargosFixosExtras: 0,
        tusdPercent: 0,
        tusdTipoCliente: 'residencial',
        tusdSubtipo: '',
        tusdSimultaneidade: null,
        tusdTarifaRkwh: null,
        tusdAnoReferencia: new Date().getFullYear(),
        tusdOpcoesExpandidas: false,
        leasingPrazo: leasingPrazo as OrcamentoSnapshotData['leasingPrazo'],
        potenciaModulo: 0,
        potenciaModuloDirty: false,
        tipoInstalacao: 'residencial',
        tipoInstalacaoOutro: '',
        tipoInstalacaoDirty: false,
        tipoSistema: 'ongrid',
        segmentoCliente: 'residencial',
        tipoEdificacaoOutro: '',
        numeroModulosManual: '',
        configuracaoUsinaObservacoes: '',
        composicaoTelhado: null,
        composicaoSolo: null,
        aprovadoresText: '',
        impostosOverridesDraft: {},
        vendasConfig: null,
        vendasSimulacoes: {},
        multiUc: { ativo: false, rows: [], rateioModo: 'proporcional', energiaGeradaKWh: 0, energiaGeradaTouched: false, anoVigencia: new Date().getFullYear(), overrideEscalonamento: false, escalonamentoCustomPercent: null },
        precoPorKwp: 0,
        irradiacao: 0,
        eficiencia: 0.8,
        diasMes: 30,
        inflacaoAa: 0,
        vendaForm: {
          consumo_kwh_mes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
          modelo_inversor: ep?.marca_inversor ?? '',
        } as VendaForm,
        capexManualOverride: false,
        parsedVendaPdf: null as ParsedVendaPdfData | null,
        estruturaTipoWarning: null,
        jurosFinAa: 0,
        prazoFinMeses: 0,
        entradaFinPct: 0,
        mostrarFinanciamento: false,
        mostrarGrafico: true,
        useBentoGridPdf: false,
        prazoMeses: ep?.prazo_meses != null ? Number(ep.prazo_meses) : 240,
        bandeiraEncargo: 0,
        cipEncargo: 0,
        entradaRs: 0,
        entradaModo: 'percentual',
        mostrarValorMercadoLeasing: false,
        mostrarTabelaParcelas: false,
        mostrarTabelaBuyout: false,
        mostrarTabelaParcelasConfig: false,
        mostrarTabelaBuyoutConfig: false,
        oemBase: 0,
        oemInflacao: 0,
        seguroModo: 'percentual',
        seguroReajuste: 0,
        seguroValorA: 0,
        seguroPercentualB: 0,
        exibirLeasingLinha: true,
        exibirFinLinha: false,
        cashbackPct: 0,
        depreciacaoAa: 0,
        inadimplenciaAa: 0,
        tributosAa: 0,
        ipcaAa: 0,
        custosFixosM: 0,
        opexM: 0,
        seguroM: 0,
        duracaoMeses: 0,
        pagosAcumAteM: 0,
        modoOrcamento: 'auto',
        autoKitValor: null,
        autoCustoFinal: null,
        autoPricingRede: null,
        autoPricingVersion: null,
        autoBudgetReason: null,
        autoBudgetReasonCode: null,
        tipoRede: resolvedTipoRede,
        tipoRedeControle: 'manual',
        temCorresponsavelFinanceiro: false,
        corresponsavel: null,
        leasingAnexosSelecionados: [],
        vendaSnapshot: null as unknown as VendaSnapshot,
        leasingSnapshot: {
          prazoContratualMeses: ep?.prazo_meses != null ? Number(ep.prazo_meses) : 240,
          energiaContratadaKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
          tarifaInicial: resolvedTarifaAtual != null ? Number(resolvedTarifaAtual) : 0,
          descontoContratual: resolvedDesconto != null ? Number(resolvedDesconto) : 0,
          inflacaoEnergiaAa: 0,
          investimentoSolarinvest: 0,
          dataInicioOperacao: '',
          responsavelSolarinvest: 'Operação, manutenção, suporte técnico, limpeza e seguro da usina.',
          valorDeMercadoEstimado: 0,
          dadosTecnicos: {
            potenciaInstaladaKwp: ep?.potencia_kwp != null ? Number(ep.potencia_kwp) : 0,
            geracaoEstimadakWhMes: 0,
            energiaContratadaKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
            potenciaPlacaWp: 0,
            numeroModulos: 0,
            tipoInstalacao: '',
            areaUtilM2: 0,
          },
          projecao: {
            mensalidadesAno: [[ep?.mensalidade != null ? Number(ep.mensalidade) : 0]],
            economiaProjetada: [],
          },
          contrato: {
            tipoContrato: 'residencial',
            dataInicio: '',
            dataFim: '',
            dataHomologacao: '',
            localEntrega: '',
            ucGeradoraTitularDiferente: false,
            ucGeradoraTitular: null,
            ucGeradoraTitularDraft: null,
            ucGeradoraTitularDistribuidoraAneel: '',
            ucGeradora_importarEnderecoCliente: false,
            modulosFV: '',
            inversoresFV: ep?.marca_inversor ?? '',
            nomeCondominio: '',
            cnpjCondominio: '',
            nomeSindico: '',
            cpfSindico: '',
            temCorresponsavelFinanceiro: false,
            corresponsavel: null,
            proprietarios: [{ nome: '', cpfCnpj: '' }],
          },
        } as unknown as LeasingState,
      } as unknown as OrcamentoSnapshotData)
    : undefined

  return {
    id: row.id,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
    ...(ownerName != null ? { ownerName } : {}),
    ...(ownerEmail != null ? { ownerEmail } : {}),
    ...(ownerUserId != null ? { ownerUserId } : {}),
    createdByUserId: row.created_by_user_id ?? null,
    deletedAt: row.deleted_at ?? null,
    inPortfolio: Boolean(row.in_portfolio),
    clientActivatedAt: row.portfolio_exported_at ?? null,
    consumption_kwh_month: resolvedKwhContratado,
    system_kwp: row.systemKwp ?? null,
    term_months: row.termMonths ?? null,
    dados,
    ...(propostaSnapshot != null ? { propostaSnapshot } : {}),
  }
}

// ---------------------------------------------------------------------------
// Unused imports needed by App.tsx that were accidentally included above
// (kept to avoid breaking type-only re-exports)
// ---------------------------------------------------------------------------

// These are only needed to satisfy TypeScript for the serverClientToRegistro
// function above – they're already in the import list.
export type { PrintableProposalTipo }
