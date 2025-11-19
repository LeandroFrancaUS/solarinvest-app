import { createStore } from './createStore'
import type { DadosTUSD, TarifaAtual, TarifaHistorica } from '../lib/aneel/aneelClient'

type TarifaState = {
  tarifasAtuais: Record<string, TarifaAtual>
  historicos: Record<string, TarifaHistorica[]>
  dadosTUSD: Record<string, DadosTUSD>
  salvarTarifaAtual: (id: string, tarifa: TarifaAtual) => void
  salvarHistorico: (id: string, historico: TarifaHistorica[]) => void
  salvarDadosTUSD: (id: string, dados: DadosTUSD) => void
  limpar: () => void
}

export const useSimulacaoTarifaStore = createStore<TarifaState>((set, get) => ({
  tarifasAtuais: {},
  historicos: {},
  dadosTUSD: {},
  salvarTarifaAtual: (id, tarifa) =>
    set(() => ({
      tarifasAtuais: { ...get().tarifasAtuais, [id]: tarifa },
    })),
  salvarHistorico: (id, historico) =>
    set(() => ({
      historicos: { ...get().historicos, [id]: historico },
    })),
  salvarDadosTUSD: (id, dados) =>
    set(() => ({
      dadosTUSD: { ...get().dadosTUSD, [id]: dados },
    })),
  limpar: () =>
    set(() => ({
      tarifasAtuais: {},
      historicos: {},
      dadosTUSD: {},
    })),
}))
