import {
  EntradaModo,
  creditoMensal,
  kcAjustadoPorEntrada,
  mensalidadeLiquida,
  tarifaDescontada,
  toMonthly,
  valorCompraCliente,
} from './utils/calcs'

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
  return tarifaDescontada(state.tarifaCheia, state.desconto, state.inflacaoAa, m)
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
  const inflacaoMensal = selectInflacaoMensal(state)
  const linhas: BuyoutLinha[] = []
  let prestacaoAcum = 0

  for (let mes = 1; mes <= duracao; mes += 1) {
    const fatorCrescimento = Math.pow(1 + inflacaoMensal, Math.max(0, mes - 1))
    const tarifaCheiaMes = state.tarifaCheia * fatorCrescimento
    const tarifaLiquida = selectTarifaDescontada(state, mes)
    const prestBruta =
      state.geracaoMensalKwh * tarifaLiquida + state.taxaMinima + state.custosFixosM + state.opexM + state.seguroM
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
