import type { AfDeslocamentoStore } from './useAfDeslocamentoStore'

export const selectAfCidadeDestino = (s: AfDeslocamentoStore) => s.afCidadeDestino
export const selectAfDeslocamentoKm = (s: AfDeslocamentoStore) => s.afDeslocamentoKm
export const selectAfDeslocamentoRs = (s: AfDeslocamentoStore) => s.afDeslocamentoRs
export const selectAfDeslocamentoStatus = (s: AfDeslocamentoStore) => s.afDeslocamentoStatus
export const selectAfDeslocamentoCidadeLabel = (s: AfDeslocamentoStore) => s.afDeslocamentoCidadeLabel
export const selectAfDeslocamentoErro = (s: AfDeslocamentoStore) => s.afDeslocamentoErro
export const selectAfCidadeSuggestions = (s: AfDeslocamentoStore) => s.afCidadeSuggestions
export const selectAfCidadeShowSuggestions = (s: AfDeslocamentoStore) => s.afCidadeShowSuggestions

export const selectSetAfCidadeDestino = (s: AfDeslocamentoStore) => s.setAfCidadeDestino
export const selectSetAfDeslocamentoKm = (s: AfDeslocamentoStore) => s.setAfDeslocamentoKm
export const selectSetAfDeslocamentoRs = (s: AfDeslocamentoStore) => s.setAfDeslocamentoRs
export const selectSetAfDeslocamentoStatus = (s: AfDeslocamentoStore) => s.setAfDeslocamentoStatus
export const selectSetAfDeslocamentoCidadeLabel = (s: AfDeslocamentoStore) => s.setAfDeslocamentoCidadeLabel
export const selectSetAfDeslocamentoErro = (s: AfDeslocamentoStore) => s.setAfDeslocamentoErro
export const selectSetAfCidadeSuggestions = (s: AfDeslocamentoStore) => s.setAfCidadeSuggestions
export const selectSetAfCidadeShowSuggestions = (s: AfDeslocamentoStore) => s.setAfCidadeShowSuggestions
export const selectSelectCidadeAndCalculateDeslocamento = (s: AfDeslocamentoStore) =>
  s.selectCidadeAndCalculateDeslocamento
export const selectClearCidadeAndDeslocamento = (s: AfDeslocamentoStore) =>
  s.clearCidadeAndDeslocamento
export const selectResetAfDeslocamento = (s: AfDeslocamentoStore) => s.resetAfDeslocamento
