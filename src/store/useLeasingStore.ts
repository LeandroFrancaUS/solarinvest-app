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
}

type Listener = () => void

const listeners = new Set<Listener>()

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
})

let state: LeasingState = createInitialState()
const INITIAL_STATE_SIGNATURE = JSON.stringify(state)

const cloneState = (input: LeasingState): LeasingState => ({
  ...input,
  dadosTecnicos: { ...input.dadosTecnicos },
  projecao: {
    mensalidadesAno: input.projecao.mensalidadesAno.map((item) => ({ ...item })),
    economiaProjetada: input.projecao.economiaProjetada.map((item) => ({ ...item })),
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
}

export default useLeasingStore
