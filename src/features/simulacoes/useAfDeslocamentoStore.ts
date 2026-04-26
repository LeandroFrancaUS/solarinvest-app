import type { CidadeDB } from '../../data/cidades'
import { calculateInstallerTravelCost, isExemptRegion } from '../../lib/finance/travelCost'
import { calcRoundTripKm } from '../../shared/geocoding'
import { createStore } from '../../store/createStore'

export type AfDeslocamentoStatus = 'idle' | 'loading' | 'isenta' | 'ok' | 'error'

export interface AfDeslocamentoState {
  afCidadeDestino: string
  afDeslocamentoKm: number
  afDeslocamentoRs: number
  afDeslocamentoStatus: AfDeslocamentoStatus
  afDeslocamentoCidadeLabel: string
  afDeslocamentoErro: string
  afCidadeSuggestions: CidadeDB[]
  afCidadeShowSuggestions: boolean
}

export interface AfTravelConfig {
  faixa1Km: number
  faixa1Valor: number
  faixa2Km: number
  faixa2Valor: number
  kmExcedenteValor: number
}

export interface AfSelectCidadeOptions {
  travelConfig: AfTravelConfig
  regioesIsentas: string[]
  resolveUfOverride?: (city: CidadeDB) => '' | 'GO' | 'DF'
}

export interface AfDeslocamentoActions {
  setAfCidadeDestino: (value: string) => void
  setAfDeslocamentoKm: (value: number) => void
  setAfDeslocamentoRs: (value: number) => void
  setAfDeslocamentoStatus: (value: AfDeslocamentoStatus) => void
  setAfDeslocamentoCidadeLabel: (value: string) => void
  setAfDeslocamentoErro: (value: string) => void
  setAfCidadeSuggestions: (value: CidadeDB[]) => void
  setAfCidadeShowSuggestions: (value: boolean) => void
  selectCidadeAndCalculateDeslocamento: (
    city: CidadeDB,
    options: AfSelectCidadeOptions,
  ) => { ufOverride: '' | 'GO' | 'DF'; deslocamentoRs: number }
  clearCidadeAndDeslocamento: () => void
  resetAfDeslocamento: () => void
}

export type AfDeslocamentoStore = AfDeslocamentoState & AfDeslocamentoActions

const parseRegioesIsentas = (regioesIsentas: string[]) =>
  regioesIsentas
    .map((value) => value.trim())
    .map((value) => {
      const match = value.match(/^(.+?)[\s/,\-]+([A-Za-z]{2})$/)
      const cidade = match?.[1]?.trim()
      const uf = match?.[2]?.toUpperCase()
      if (cidade && uf) {
        return { cidade, uf }
      }
      return { cidade: value, uf: '' }
    })

const AF_DESLOCAMENTO_DEFAULTS: AfDeslocamentoState = {
  afCidadeDestino: '',
  afDeslocamentoKm: 0,
  afDeslocamentoRs: 0,
  afDeslocamentoStatus: 'idle',
  afDeslocamentoCidadeLabel: '',
  afDeslocamentoErro: '',
  afCidadeSuggestions: [],
  afCidadeShowSuggestions: false,
}

export const useAfDeslocamentoStore = createStore<AfDeslocamentoStore>((set) => ({
  ...AF_DESLOCAMENTO_DEFAULTS,
  setAfCidadeDestino: (value) => set({ afCidadeDestino: value }),
  setAfDeslocamentoKm: (value) => set({ afDeslocamentoKm: value }),
  setAfDeslocamentoRs: (value) => set({ afDeslocamentoRs: value }),
  setAfDeslocamentoStatus: (value) => set({ afDeslocamentoStatus: value }),
  setAfDeslocamentoCidadeLabel: (value) => set({ afDeslocamentoCidadeLabel: value }),
  setAfDeslocamentoErro: (value) => set({ afDeslocamentoErro: value }),
  setAfCidadeSuggestions: (value) => set({ afCidadeSuggestions: value }),
  setAfCidadeShowSuggestions: (value) => set({ afCidadeShowSuggestions: value }),
  selectCidadeAndCalculateDeslocamento: (city, options) => {
    const ufOverride = options.resolveUfOverride
      ? options.resolveUfOverride(city)
      : city.uf === 'DF'
        ? 'DF'
        : 'GO'
    const travelConfig = {
      faixa1MaxKm: options.travelConfig.faixa1Km,
      faixa1Rs: options.travelConfig.faixa1Valor,
      faixa2MaxKm: options.travelConfig.faixa2Km,
      faixa2Rs: options.travelConfig.faixa2Valor,
      kmExcedenteRs: options.travelConfig.kmExcedenteValor,
      exemptRegions: parseRegioesIsentas(options.regioesIsentas),
    }
    const label = `${city.cidade}/${city.uf}`

    set({
      afCidadeDestino: `${city.cidade} - ${city.uf}`,
      afCidadeSuggestions: [],
      afCidadeShowSuggestions: false,
    })

    if (isExemptRegion(city.cidade, city.uf, travelConfig.exemptRegions)) {
      set({
        afDeslocamentoKm: 0,
        afDeslocamentoRs: 0,
        afDeslocamentoStatus: 'isenta',
        afDeslocamentoCidadeLabel: label,
        afDeslocamentoErro: '',
      })
      return { ufOverride, deslocamentoRs: 0 }
    }

    const km = calcRoundTripKm(city.lat, city.lng)
    const custo = calculateInstallerTravelCost(km, travelConfig)
    set({
      afDeslocamentoKm: km,
      afDeslocamentoRs: custo,
      afDeslocamentoStatus: 'ok',
      afDeslocamentoCidadeLabel: label,
      afDeslocamentoErro: '',
    })
    return { ufOverride, deslocamentoRs: custo }
  },
  clearCidadeAndDeslocamento: () =>
    set({
      afCidadeDestino: '',
      afCidadeSuggestions: [],
      afCidadeShowSuggestions: false,
      afDeslocamentoKm: 0,
      afDeslocamentoRs: 0,
      afDeslocamentoStatus: 'idle',
      afDeslocamentoCidadeLabel: '',
      afDeslocamentoErro: '',
    }),
  resetAfDeslocamento: () => set({ ...AF_DESLOCAMENTO_DEFAULTS }),
}))
