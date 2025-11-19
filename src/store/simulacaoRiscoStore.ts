import { createStore } from './createStore'
import type { SimulacaoMonteCarloResultado } from '../lib/finance/simulacaoEngineV35'

type RiscoState = {
  resultados: Record<string, SimulacaoMonteCarloResultado>
  ultimaExecucao?: string
  salvarResultado: (simId: string, resultado: SimulacaoMonteCarloResultado) => void
  limpar: (simId?: string) => void
}

export const useSimulacaoRiscoStore = createStore<RiscoState>((set, get) => ({
  resultados: {},
  ultimaExecucao: undefined,
  salvarResultado: (simId, resultado) =>
    set(() => ({
      resultados: { ...get().resultados, [simId]: resultado },
      ultimaExecucao: new Date().toISOString(),
    })),
  limpar: (simId) =>
    set(() => {
      if (!simId) {
        return { resultados: {}, ultimaExecucao: undefined }
      }
      const { [simId]: _, ...resto } = get().resultados
      return { resultados: resto }
    }),
}))
