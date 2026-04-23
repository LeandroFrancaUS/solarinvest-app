import { useCallback, useSyncExternalStore } from 'react'
import { isCrashRecovery } from './crashRecovery'
import { VALOR_MERCADO_MULTIPLICADOR } from '../lib/finance/simulation'

export type LeasingDadosTecnicos = {
  potenciaInstaladaKwp: number
  /** Monthly generation estimate in kWh/month. */
  geracaoEstimadakWhMes: number
  /** Monthly contracted energy in kWh/month. Mirrors LeasingState.energiaContratadaKwhMes — kept in sync by leasingActions. */
  energiaContratadaKwhMes: number
  /** Module power in Wp ("placa" = módulo). */
  potenciaPlacaWp: number
  numeroModulos: number
  tipoInstalacao: string
  areaUtilM2: number
}

export type LeasingMensalidadeAno = {
  ano: number
  tarifaCheia: number
  tarifaComDesconto: number
  contaDistribuidora: number
  mensalidade: number
}

export type LeasingEconomiaPonto = {
  ano: number
  economiaAnual: number
  economiaAcumulada: number
}

export type LeasingProjecao = {
  mensalidadesAno: LeasingMensalidadeAno[]
  economiaProjetada: LeasingEconomiaPonto[]
}

export type LeasingContratoProprietario = {
  nome: string
  cpfCnpj: string
}

export type LeasingEndereco = {
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export type LeasingCorresponsavel = {
  nome: string
  nacionalidade: string
  estadoCivil: string
  cpf: string
  endereco: LeasingEndereco | string
  email: string
  telefone: string
}

export type LeasingUcGeradoraTitular = {
  nomeCompleto: string
  cpf: string
  rg: string
  endereco: LeasingEndereco
}

export type LeasingContratoDados = {
  tipoContrato: 'residencial' | 'condominio'
  dataInicio: string
  dataFim: string
  dataHomologacao: string
  localEntrega: string
  ucGeradoraTitularDiferente: boolean
  ucGeradoraTitular: LeasingUcGeradoraTitular | null
  ucGeradoraTitularDraft: LeasingUcGeradoraTitular | null
  ucGeradoraTitularDistribuidoraAneel: string
  ucGeradora_importarEnderecoCliente: boolean
  modulosFV: string
  inversoresFV: string
  nomeCondominio: string
  cnpjCondominio: string
  nomeSindico: string
  cpfSindico: string
  temCorresponsavelFinanceiro: boolean
  corresponsavel: LeasingCorresponsavel | null
  proprietarios: LeasingContratoProprietario[]
}

export type LeasingState = {
  /** Contract term in months (e.g. 240 = 20 years). */
  prazoContratualMeses: number
  /**
   * Contracted monthly energy in kWh/month.
   * Root-level convenience copy — must stay in sync with dadosTecnicos.energiaContratadaKwhMes.
   * Always update via leasingActions.syncEnergiaContratada() or leasingActions.update() which
   * automatically mirrors the value into dadosTecnicos.
   */
  energiaContratadaKwhMes: number
  /** Initial tariff in R$/kWh (full tariff at month 1, before discount). */
  tarifaInicial: number
  /**
   * Contractual discount as a percentage (0–100).
   * Example: 20 means 20 % off the full tariff.
   * Consumers must divide by 100 before applying as a fraction.
   */
  descontoContratual: number
  /** Annual energy inflation as a decimal fraction (e.g. 0.06 = 6 % per year). */
  inflacaoEnergiaAa: number
  /** SolarInvest investment (CAPEX) in R$. */
  investimentoSolarinvest: number
  dataInicioOperacao: string
  responsavelSolarinvest: string
  /**
   * Estimated market value of the installed system in R$.
   * Automatically derived as `investimentoSolarinvest * VALOR_MERCADO_MULTIPLICADOR` (1.29)
   * whenever `investimentoSolarinvest` is updated via `leasingActions.update()`.
   * To override manually, call `leasingActions.setValorDeMercadoEstimado()` after the capex update.
   */
  valorDeMercadoEstimado: number
  dadosTecnicos: LeasingDadosTecnicos
  projecao: LeasingProjecao
  contrato: LeasingContratoDados
}

type Listener = () => void

const listeners = new Set<Listener>()

const STORAGE_KEY = 'solarinvest:leasing-form:v1'

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

const createInitialState = (): LeasingState => ({
  prazoContratualMeses: 0,
  energiaContratadaKwhMes: 0,
  tarifaInicial: 0,
  descontoContratual: 0,
  inflacaoEnergiaAa: 0,
  investimentoSolarinvest: 0,
  dataInicioOperacao: '',
  responsavelSolarinvest: 'Operação, manutenção, suporte técnico, limpeza e seguro da usina.',
  valorDeMercadoEstimado: 0,
  dadosTecnicos: {
    potenciaInstaladaKwp: 0,
    geracaoEstimadakWhMes: 0,
    energiaContratadaKwhMes: 0,
    potenciaPlacaWp: 0,
    numeroModulos: 0,
    tipoInstalacao: '',
    areaUtilM2: 0,
  },
  projecao: {
    mensalidadesAno: [],
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
    inversoresFV: '',
    nomeCondominio: '',
    cnpjCondominio: '',
    nomeSindico: '',
    cpfSindico: '',
    temCorresponsavelFinanceiro: false,
    corresponsavel: null,
    proprietarios: [{ nome: '', cpfCnpj: '' }],
  },
})

const cloneUcGeradoraTitular = (
  input: LeasingUcGeradoraTitular | null | undefined,
): LeasingUcGeradoraTitular | null => {
  if (!input) {
    return null
  }
  return {
    ...input,
    endereco: { ...input.endereco },
  }
}

const resolveUcGeradoraTitular = (
  value: LeasingUcGeradoraTitular | null | undefined,
  fallback: LeasingUcGeradoraTitular | null,
): LeasingUcGeradoraTitular | null => {
  if (value === null) {
    return null
  }
  if (value === undefined) {
    return fallback
  }
  return cloneUcGeradoraTitular(value)
}

const cloneCorresponsavel = (
  input: LeasingCorresponsavel | null | undefined,
): LeasingCorresponsavel | null => {
  if (!input) {
    return null
  }
  return {
    ...input,
    endereco: typeof input.endereco === 'string' ? input.endereco : { ...input.endereco },
  }
}

const resolveCorresponsavel = (
  value: LeasingCorresponsavel | null | undefined,
  fallback: LeasingCorresponsavel | null,
): LeasingCorresponsavel | null => {
  if (value === null) {
    return null
  }
  if (value === undefined) {
    return fallback
  }
  return cloneCorresponsavel(value)
}

const mergeState = (incoming: Partial<LeasingState> | null): LeasingState => {
  const base = createInitialState()
  if (!incoming) {
    return base
  }
  const contratoIncoming = incoming.contrato
  const ucGeradoraTitular = resolveUcGeradoraTitular(
    contratoIncoming?.ucGeradoraTitular,
    base.contrato.ucGeradoraTitular,
  )
  const ucGeradoraTitularDraft = resolveUcGeradoraTitular(
    contratoIncoming?.ucGeradoraTitularDraft,
    base.contrato.ucGeradoraTitularDraft,
  )
  const corresponsavel = resolveCorresponsavel(
    contratoIncoming?.corresponsavel,
    base.contrato.corresponsavel,
  )
  const ucGeradoraTitularDiferente = Boolean(
    (incoming.contrato?.ucGeradoraTitularDiferente ?? base.contrato.ucGeradoraTitularDiferente) &&
      ucGeradoraTitular,
  )
  const merged: LeasingState = {
    ...base,
    ...incoming,
    dadosTecnicos: { ...base.dadosTecnicos, ...(incoming.dadosTecnicos ?? {}) },
    projecao: {
      mensalidadesAno: Array.isArray(incoming.projecao?.mensalidadesAno)
        ? incoming.projecao.mensalidadesAno.map((item) => ({ ...item }))
        : base.projecao.mensalidadesAno,
      economiaProjetada: Array.isArray(incoming.projecao?.economiaProjetada)
        ? incoming.projecao.economiaProjetada.map((item) => ({ ...item }))
        : base.projecao.economiaProjetada,
    },
    contrato: {
      ...base.contrato,
      ...(incoming.contrato ?? {}),
      proprietarios: Array.isArray(incoming.contrato?.proprietarios)
        ? incoming.contrato.proprietarios.map((item) => ({ ...item }))
        : base.contrato.proprietarios,
      ucGeradoraTitularDiferente,
      ucGeradoraTitular,
      ucGeradoraTitularDraft,
      ucGeradora_importarEnderecoCliente:
        incoming.contrato?.ucGeradora_importarEnderecoCliente ??
        base.contrato.ucGeradora_importarEnderecoCliente,
      temCorresponsavelFinanceiro:
        incoming.contrato?.temCorresponsavelFinanceiro ??
        base.contrato.temCorresponsavelFinanceiro,
      corresponsavel,
    },
  }
  // Reconcile energiaContratadaKwhMes: root wins when nonzero; otherwise use nested value.
  // This ensures the two copies never diverge after loading from sessionStorage.
  const rootEnergy = merged.energiaContratadaKwhMes
  const nestedEnergy = merged.dadosTecnicos.energiaContratadaKwhMes
  const resolvedEnergy = rootEnergy > 0 ? rootEnergy : nestedEnergy
  if (resolvedEnergy !== rootEnergy) {
    merged.energiaContratadaKwhMes = resolvedEnergy
  }
  if (resolvedEnergy !== nestedEnergy) {
    merged.dadosTecnicos = { ...merged.dadosTecnicos, energiaContratadaKwhMes: resolvedEnergy }
  }
  return merged
}

const loadStoredState = (): LeasingState => {
  if (!canUseSessionStorage()) {
    return createInitialState()
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialState()
    }
    const parsed = JSON.parse(raw) as Partial<LeasingState>
    return mergeState(parsed)
  } catch (error) {
    console.warn('[useLeasingStore] failed to load stored state', error)
    return createInitialState()
  }
}

const cloneState = (input: LeasingState): LeasingState => ({
  ...input,
  dadosTecnicos: { ...input.dadosTecnicos },
  projecao: {
    mensalidadesAno: input.projecao.mensalidadesAno.map((item) => ({ ...item })),
    economiaProjetada: input.projecao.economiaProjetada.map((item) => ({ ...item })),
  },
  contrato: {
    ...input.contrato,
    proprietarios: input.contrato.proprietarios.map((item) => ({ ...item })),
    ucGeradoraTitular: cloneUcGeradoraTitular(input.contrato.ucGeradoraTitular),
    ucGeradoraTitularDraft: cloneUcGeradoraTitular(input.contrato.ucGeradoraTitularDraft),
    corresponsavel: cloneCorresponsavel(input.contrato.corresponsavel),
  },
})

const persistState = (next: LeasingState) => {
  if (!canUseSessionStorage()) {
    return
  }
  try {
    const payload = cloneState(next)
    payload.contrato.ucGeradoraTitularDraft = null
    payload.contrato.ucGeradoraTitularDiferente = Boolean(
      payload.contrato.ucGeradoraTitularDiferente && payload.contrato.ucGeradoraTitular,
    )
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('[useLeasingStore] failed to persist state', error)
  }
}

let state: LeasingState = isCrashRecovery() ? loadStoredState() : createInitialState()
const INITIAL_STATE_SIGNATURE = JSON.stringify(createInitialState())

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('[useLeasingStore] listener error', error)
    }
  })
}

const setState = (updater: (draft: LeasingState) => void) => {
  const draft = cloneState(state)
  updater(draft)
  state = draft
  persistState(state)
  notify()
}

const leasingStore = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

const isStatePristine = (input: LeasingState): boolean => JSON.stringify(input) === INITIAL_STATE_SIGNATURE

export const isLeasingStatePristine = (input: LeasingState): boolean => isStatePristine(input)

export const hasLeasingStateChanges = (): boolean => !isStatePristine(leasingStore.getState())

export const useLeasingStore = <T,>(selector: (state: LeasingState) => T): T => {
  const getSnapshot = useCallback(() => selector(leasingStore.getState()), [selector])
  return useSyncExternalStore((listener) => leasingStore.subscribe(listener), getSnapshot)
}

export const getLeasingSnapshot = (): LeasingState => {
  const snapshot = cloneState(leasingStore.getState())
  snapshot.contrato.ucGeradoraTitularDraft = null
  snapshot.contrato.ucGeradoraTitularDiferente = Boolean(
    snapshot.contrato.ucGeradoraTitularDiferente && snapshot.contrato.ucGeradoraTitular,
  )
  return snapshot
}

export const getInitialLeasingSnapshot = (): LeasingState => createInitialState()

export const selectLeasingValorDeMercadoEstimado = (state: LeasingState): number =>
  state.valorDeMercadoEstimado

export const getLeasingValorDeMercadoEstimado = (): number =>
  leasingStore.getState().valorDeMercadoEstimado

export const useLeasingValorDeMercadoEstimado = (): number =>
  useLeasingStore(selectLeasingValorDeMercadoEstimado)

export const leasingActions = {
  reset() {
    state = createInitialState()
    if (canUseSessionStorage()) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
    notify()
  },
  update(partial: Partial<LeasingState>) {
    setState((draft) => {
      Object.assign(draft, partial)
      // Keep energiaContratadaKwhMes in sync between root and dadosTecnicos.
      // When the root field is explicitly set, mirror it down; when only dadosTecnicos is
      // updated via updateDadosTecnicos(), the root is mirrored up there.
      if ('energiaContratadaKwhMes' in partial && typeof partial.energiaContratadaKwhMes === 'number') {
        draft.dadosTecnicos = {
          ...draft.dadosTecnicos,
          energiaContratadaKwhMes: partial.energiaContratadaKwhMes,
        }
      }
      // Auto-derive valorDeMercadoEstimado when investimentoSolarinvest changes and the caller
      // did NOT supply an explicit valorDeMercadoEstimado override.
      if (
        'investimentoSolarinvest' in partial &&
        !('valorDeMercadoEstimado' in partial)
      ) {
        const capex = typeof partial.investimentoSolarinvest === 'number' ? partial.investimentoSolarinvest : 0
        draft.valorDeMercadoEstimado = capex * VALOR_MERCADO_MULTIPLICADOR
      }
    })
  },
  updateDadosTecnicos(partial: Partial<LeasingDadosTecnicos>) {
    setState((draft) => {
      draft.dadosTecnicos = { ...draft.dadosTecnicos, ...partial }
      // Mirror energiaContratadaKwhMes up to the root field when updated in dadosTecnicos.
      if ('energiaContratadaKwhMes' in partial && typeof partial.energiaContratadaKwhMes === 'number') {
        draft.energiaContratadaKwhMes = partial.energiaContratadaKwhMes
      }
    })
  },
  updateProjecao(partial: Partial<LeasingProjecao>) {
    setState((draft) => {
      draft.projecao = {
        mensalidadesAno: partial.mensalidadesAno
          ? partial.mensalidadesAno.map((item) => ({ ...item }))
          : draft.projecao.mensalidadesAno.map((item) => ({ ...item })),
        economiaProjetada: partial.economiaProjetada
          ? partial.economiaProjetada.map((item) => ({ ...item }))
          : draft.projecao.economiaProjetada.map((item) => ({ ...item })),
      }
    })
  },
  setValorDeMercadoEstimado(valor: number) {
    setState((draft) => {
      draft.valorDeMercadoEstimado = valor
    })
  },
  updateContrato(partial: Partial<LeasingContratoDados>) {
    setState((draft) => {
      const proprietarios = partial.proprietarios
        ? partial.proprietarios.map((item) => ({ ...item }))
        : draft.contrato.proprietarios.map((item) => ({ ...item }))
      const ucGeradoraTitular = resolveUcGeradoraTitular(
        partial.ucGeradoraTitular,
        draft.contrato.ucGeradoraTitular,
      )
      const ucGeradoraTitularDraft = resolveUcGeradoraTitular(
        partial.ucGeradoraTitularDraft,
        draft.contrato.ucGeradoraTitularDraft,
      )
      const corresponsavel = resolveCorresponsavel(
        partial.corresponsavel,
        draft.contrato.corresponsavel,
      )
      draft.contrato = {
        ...draft.contrato,
        ...partial,
        proprietarios,
        ucGeradoraTitular,
        ucGeradoraTitularDraft,
        corresponsavel,
      }
    })
  },
  importEnderecoClienteParaUcGeradora(source: {
    cep?: string
    logradouro?: string
    cidade?: string
    uf?: string
    distribuidora?: string
  }) {
    setState((draft) => {
      const contrato = draft.contrato
      const destino = contrato.ucGeradoraTitularDraft
      if (!destino) {
        return
      }
      if (source.cep) {
        destino.endereco.cep = source.cep
      }
      if (source.logradouro) {
        destino.endereco.logradouro = source.logradouro
      }
      if (source.cidade) {
        destino.endereco.cidade = source.cidade
      }
      if (source.uf) {
        destino.endereco.uf = source.uf
      }
      if (source.distribuidora) {
        contrato.ucGeradoraTitularDistribuidoraAneel = source.distribuidora
      }
    })
  },
}

export default useLeasingStore
