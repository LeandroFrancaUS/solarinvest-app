import { num } from '../safe'

export type PropostaState = {
  orcamento?: {
    modulo?: {
      potenciaW?: unknown
    }
  }
  leasing?: {
    prazo_meses?: unknown
  }
}

export const getPotenciaModuloW = (state: PropostaState): number => {
  const valor = state?.orcamento?.modulo?.potenciaW
  return num(valor, 0)
}
