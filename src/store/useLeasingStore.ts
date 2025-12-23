import { useCallback, useSyncExternalStore } from 'react'

export type LeasingDadosTecnicos = {
  potenciaInstaladaKwp: number
  geracaoEstimadakWhMes: number
  energiaContratadaKwhMes: number
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

export type LeasingContratoDados = {
  tipoContrato: 'residencial' | 'condominio'
  dataInicio: string
  dataFim: string
  dataHomologacao: string
  localEntrega: string
  modulosFV: string
  inversoresFV: string
  nomeCondominio: string
  cnpjCondominio: string
  nomeSindico: string
  cpfSindico: string
  proprietarios: LeasingContratoProprietario[]
}

export type LeasingState = {
  prazoContratualMeses: number
  energiaContratadaKwhMes: number
  tarifaInicial: number
  descontoContratual: number
  inflacaoEnergiaAa: number
  investimentoSolarinvest: number
  dataInicioOperacao: string
  responsavelSolarinvest: string
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
    modulosFV: '',
    inversoresFV: '',
    nomeCondominio: '',
    cnpjCondominio: '',
    nomeSindico: '',
    cpfSindico: '',
    proprietarios: [{ nome: '', cpfCnpj: '' }],
  },
})

const mergeState = (incoming: Partial<LeasingState> | null): LeasingState => {
  const base = createInitialState()
  if (!incoming) {
    return base
  }
  return {
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
    },
  }
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

const persistState = (next: LeasingState) => {
  if (!canUseSessionStorage()) {
    return
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn('[useLeasingStore] failed to persist state', error)
  }
}

let state: LeasingState = loadStoredState()
const INITIAL_STATE_SIGNATURE = JSON.stringify(createInitialState())

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
  },
})

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
  return useSyncExternalStore(leasingStore.subscribe, getSnapshot)
}

export const getLeasingSnapshot = (): LeasingState => cloneState(leasingStore.getState())

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
    })
  },
  updateDadosTecnicos(partial: Partial<LeasingDadosTecnicos>) {
    setState((draft) => {
      draft.dadosTecnicos = { ...draft.dadosTecnicos, ...partial }
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
      draft.contrato = {
        ...draft.contrato,
        ...partial,
        proprietarios,
      }
    })
  },
}

export default useLeasingStore
