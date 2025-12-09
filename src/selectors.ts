import {
  creditoMensal,
  kcAjustadoPorEntrada,
  mensalidadeLiquida,
  tarifaProjetadaCheia,
  tarifaDescontada,
  toMonthly,
  valorCompraCliente,
  type EntradaModo,
} from './utils/calcs'
import type { TipoRede } from './app/config'
import type { TipoClienteTUSD } from './lib/finance/tusd'

export interface SimulationState {
  kcKwhMes: number
  tarifaCheia: number
  desconto: number
  inflacaoAa: number
  prazoMeses: number
  taxaMinima: number
  encargosFixos: number
  entradaRs: number
  modoEntrada: EntradaModo
  vm0: number
  depreciacaoAa: number
  ipcaAa: number
  inadimplenciaAa: number
  tributosAa: number
  custosFixosM: number
  opexM: number
  seguroM: number
  cashbackPct: number
  pagosAcumManual: number
  duracaoMeses: number
  geracaoMensalKwh: number
  mesReajuste: number
  mesReferencia: number
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string | null
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number
  aplicaTaxaMinima: boolean
  cidKwhBase: number
  tipoRede: TipoRede
}

export interface BuyoutLinha {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
  prestacaoEfetiva: number
  prestacaoAcum: number
  cashback: number
  valorResidual: number
}

export function selectInflacaoMensal(state: SimulationState): number {
  return toMonthly(state.inflacaoAa)
}

export function selectTarifaDescontada(state: SimulationState, m: number): number {
  return tarifaDescontada(
    state.tarifaCheia,
    state.desconto,
    state.inflacaoAa,
    m,
    state.mesReajuste,
    state.mesReferencia,
  )
}

export function selectMensalidades(state: SimulationState): number[] {
  return Array.from({ length: Math.max(0, Math.floor(state.prazoMeses)) }, (_, index) =>
    mensalidadeLiquida({
      kcKwhMes: state.kcKwhMes,
      tarifaCheia: state.tarifaCheia,
      desconto: state.desconto,
      inflacaoAa: state.inflacaoAa,
      m: index + 1,
      taxaMinima: state.taxaMinima,
      encargosFixos: state.encargosFixos,
      entradaRs: state.entradaRs,
      prazoMeses: state.prazoMeses,
      modoEntrada: state.modoEntrada,
      mesReajuste: state.mesReajuste,
      mesReferencia: state.mesReferencia,
      tusdConfig: {
        percent: state.tusdPercent,
        tipoCliente: state.tusdTipoCliente,
        subTipo: state.tusdSubtipo,
        simultaneidade: state.tusdSimultaneidade,
        tarifaRkwh: state.tusdTarifaRkwh,
        anoReferencia: state.tusdAnoReferencia,
      },
      aplicaTaxaMinima: state.aplicaTaxaMinima,
      cidKwhBase: state.cidKwhBase,
      tipoRede: state.tipoRede,
    }),
  )
}

export function selectMensalidadesPorAno(state: SimulationState): number[] {
  const mensalidades = selectMensalidades(state)
  if (mensalidades.length === 0) return []

  const anos = Math.ceil(mensalidades.length / 12)
  const valores: number[] = []
  for (let ano = 0; ano < anos; ano += 1) {
    const inicio = ano * 12
    const fim = Math.min(inicio + 12, mensalidades.length)
    const slice = mensalidades.slice(inicio, fim)
    if (slice.length === 0) continue
    const soma = slice.reduce((acc, value) => acc + value, 0)
    valores.push(Number((soma / slice.length).toFixed(2)))
  }
  return valores
}

export function selectBuyoutLinhas(state: SimulationState): BuyoutLinha[] {
  const duracao = Math.max(0, Math.floor(state.duracaoMeses))
  if (duracao === 0) return []

  const inadMensal = toMonthly(state.inadimplenciaAa)
  const tribMensal = toMonthly(state.tributosAa)
  const linhas: BuyoutLinha[] = []
  let prestacaoAcum = 0

  for (let mes = 1; mes <= duracao; mes += 1) {
    const tarifaCheiaMes = tarifaProjetadaCheia(
      state.tarifaCheia,
      state.inflacaoAa,
      mes,
      state.mesReajuste,
      state.mesReferencia,
    )
    const tarifaLiquida = selectTarifaDescontada(state, mes)
    const taxaMinimaAplicada = state.aplicaTaxaMinima ? state.taxaMinima : 0
    const custosFixosAplicados = state.aplicaTaxaMinima ? state.custosFixosM : 0
    const cidAplicado = state.aplicaTaxaMinima ? state.cidKwhBase * tarifaCheiaMes : 0
    const prestBruta =
      state.geracaoMensalKwh * tarifaLiquida +
      taxaMinimaAplicada +
      custosFixosAplicados +
      cidAplicado +
      state.opexM +
      state.seguroM
    const receitaEfetiva = prestBruta * (1 - inadMensal)
    const prestEfetiva = receitaEfetiva * (1 - tribMensal)
    prestacaoAcum += prestEfetiva

    const pagosEfetivos =
      state.pagosAcumManual > 0 ? Math.min(state.pagosAcumManual, prestacaoAcum) : prestacaoAcum
    const valorResidual =
      mes >= 7
        ? valorCompraCliente({
            m: mes,
            vm0: state.vm0,
            depreciacaoAa: state.depreciacaoAa,
            ipcaAa: state.ipcaAa,
            inadimplenciaAa: state.inadimplenciaAa,
            tributosAa: state.tributosAa,
            custosFixosM: state.custosFixosM,
            opexM: state.opexM,
            seguroM: state.seguroM,
            pagosAcumAteM: pagosEfetivos,
            cashbackPct: state.cashbackPct,
            duracaoMeses: state.duracaoMeses,
          })
        : 0
    linhas.push({
      mes,
      tarifaCheia: tarifaCheiaMes,
      tarifaDescontada: tarifaLiquida,
      prestacaoEfetiva: prestEfetiva,
      prestacaoAcum: prestacaoAcum,
      cashback: Math.max(0, pagosEfetivos * state.cashbackPct),
      valorResidual,
    })
  }

  return linhas
}

export function selectValorCompraPorMes(state: SimulationState): number[] {
  return selectBuyoutLinhas(state).map((linha) => linha.valorResidual)
}

export function selectCreditoMensal(state: SimulationState): number {
  return creditoMensal(state.entradaRs, state.prazoMeses)
}

export function selectKcAjustado(state: SimulationState): number {
  if (state.modoEntrada !== 'REDUZ') return Math.max(0, state.kcKwhMes)
  return kcAjustadoPorEntrada(state.kcKwhMes, state.tarifaCheia, state.desconto, state.prazoMeses, state.entradaRs)
}
