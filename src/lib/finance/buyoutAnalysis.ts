import { selectBuyoutLinhas, selectMensalidades, type SimulationState } from '../../selectors'

export interface BuyoutMonthAnalysis {
  mes: number
  valorBuyout: number
  recebimentoAcumulado: number
  roiSolarinvest: number
  mensalidadesRestantes: number
  ganhoLiquidoCliente: number
}

export interface BuyoutWindowSummary {
  melhorMesCliente: BuyoutMonthAnalysis | null
  melhorMesSolarinvest: BuyoutMonthAnalysis | null
  piorMesSolarinvest: BuyoutMonthAnalysis | null
  meses: BuyoutMonthAnalysis[]
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

const buildMonthAnalysis = (state: SimulationState, mes: number): BuyoutMonthAnalysis | null => {
  const linhas = selectBuyoutLinhas(state)
  const linha = linhas.find((item) => item.mes === mes)
  if (!linha || !Number.isFinite(linha.valorResidual) || linha.valorResidual <= 0) {
    return null
  }

  const mensalidades = selectMensalidades(state)
  const duracao = Math.max(0, Math.floor(state.duracaoMeses))
  const fim = Math.min(duracao, mensalidades.length)
  const mensalidadesRestantes = mensalidades
    .slice(mes, fim)
    .reduce((total, valor) => total + (Number.isFinite(valor) ? valor : 0), 0)

  const recebimentoAcumulado = linha.prestacaoAcum + linha.valorResidual
  const investimento = Math.max(0, state.vm0)
  const roi = investimento > 0 ? (recebimentoAcumulado - investimento) / investimento : 0

  return {
    mes,
    valorBuyout: roundMoney(linha.valorResidual),
    recebimentoAcumulado: roundMoney(recebimentoAcumulado),
    roiSolarinvest: roi,
    mensalidadesRestantes: roundMoney(mensalidadesRestantes),
    ganhoLiquidoCliente: roundMoney(mensalidadesRestantes - linha.valorResidual),
  }
}

export const analyzeBuyoutWindow = (
  state: SimulationState,
  startMes: number,
  endMes: number,
): BuyoutWindowSummary => {
  const inicio = Math.max(7, Math.floor(startMes))
  const fim = Math.max(inicio, Math.floor(endMes))

  const meses: BuyoutMonthAnalysis[] = []
  for (let mes = inicio; mes <= fim; mes += 1) {
    const item = buildMonthAnalysis(state, mes)
    if (item) meses.push(item)
  }

  const melhorMesCliente =
    meses.length > 0
      ? meses.reduce((best, current) =>
          current.ganhoLiquidoCliente > best.ganhoLiquidoCliente ? current : best,
        )
      : null

  const melhorMesSolarinvest =
    meses.length > 0
      ? meses.reduce((best, current) => (current.roiSolarinvest > best.roiSolarinvest ? current : best))
      : null

  const piorMesSolarinvest =
    meses.length > 0
      ? meses.reduce((worst, current) => (current.roiSolarinvest < worst.roiSolarinvest ? current : worst))
      : null

  return {
    melhorMesCliente,
    melhorMesSolarinvest,
    piorMesSolarinvest,
    meses,
  }
}

export const buildRoiProgression = (
  state: SimulationState,
  startMes: number,
  endMes: number,
  stepMeses: number,
): BuyoutMonthAnalysis[] => {
  const inicio = Math.max(7, Math.floor(startMes))
  const fim = Math.max(inicio, Math.floor(endMes))
  const passo = Math.max(1, Math.floor(stepMeses))

  const resultados: BuyoutMonthAnalysis[] = []
  for (let mes = inicio; mes <= fim; mes += passo) {
    const analysis = buildMonthAnalysis(state, mes)
    if (analysis) {
      resultados.push(analysis)
    }
  }

  const ultimoMes = resultados[resultados.length - 1]?.mes
  if (ultimoMes !== fim) {
    const fechamento = buildMonthAnalysis(state, fim)
    if (fechamento) {
      resultados.push(fechamento)
    }
  }

  return resultados
}
