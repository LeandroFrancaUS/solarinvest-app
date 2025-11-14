/// <reference lib="webworker" />

import {
  calcEconomiaContrato,
  calcEconomiaHorizonte,
  calcKPIs,
  calcSimulacaoDetalhesMensais,
  calcTarifaComDesconto,
  calcTusdEncargo,
  type Simulacao,
  type SimulationKPIs,
  type SimulationMonthlyDetail,
} from '../lib/finance/simulation'

export type SimulationComparisonResult = {
  sim: Simulacao
  tarifaDesconto: number
  encargoTusd: number
  indicadores: SimulationKPIs
  economiaContratoSim: number
  economiaHorizon: number
  detalhesMensais: SimulationMonthlyDetail[]
}

type ComputeMessage = {
  id: number
  type: 'COMPUTE'
  payload: {
    simulations: Simulacao[]
    comparisonHorizon: number
  }
}

type ComputeResultMessage = {
  id: number
  type: 'COMPUTE_RESULT'
  payload: SimulationComparisonResult[]
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

const isValidSimulacao = (value: Simulacao | undefined): value is Simulacao => {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string')
}

const computeRows = (simulacoes: Simulacao[], comparisonHorizon: number): SimulationComparisonResult[] => {
  return simulacoes.filter(isValidSimulacao).map((sim) => {
    const tarifaDesconto = calcTarifaComDesconto(sim.tarifa_cheia_r_kwh_m1, sim.desconto_pct)
    const tusdResumo = calcTusdEncargo(sim, 1)
    const indicadores = calcKPIs(sim)
    const economiaContratoSim = calcEconomiaContrato(sim)
    const economiaHorizon = calcEconomiaHorizonte(sim, comparisonHorizon)
    const detalhesMensais = calcSimulacaoDetalhesMensais(sim)
    return {
      sim,
      tarifaDesconto,
      encargoTusd: tusdResumo.custoTUSD_Mes_R,
      indicadores,
      economiaContratoSim,
      economiaHorizon,
      detalhesMensais,
    }
  })
}

ctx.addEventListener('message', (event: MessageEvent<ComputeMessage>) => {
  const message = event.data
  if (!message || message.type !== 'COMPUTE') {
    return
  }

  const result: ComputeResultMessage = {
    id: message.id,
    type: 'COMPUTE_RESULT',
    payload: computeRows(message.payload.simulations, message.payload.comparisonHorizon),
  }

  ctx.postMessage(result)
})
