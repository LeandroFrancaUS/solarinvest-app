/**
 * Conversões e cálculos centrais compartilhados entre leasing e buyout.
 * O objetivo é manter uma única implementação por regra de negócio.
 */

export type EntradaModo = 'CREDITO' | 'REDUZ' | 'NONE'

/**
 * Converte uma taxa anual em equivalente mensal composto.
 * Mantemos a capitalização composta para respeitar o fluxo financeiro real.
 */
export function toMonthly(rateAa: number): number {
  if (!Number.isFinite(rateAa)) return 0
  return Math.pow(1 + rateAa, 1 / 12) - 1
}

/**
 * Calcula a tarifa com desconto aplicado no mês m.
 * Fórmula: T0 * (1 + g_m)^(m-1) * (1 - desconto)
 * @param m Mês (1..prazo)
 */
export function tarifaDescontada(
  tarifaCheia: number,
  desconto: number,
  inflacaoAa: number,
  m: number,
): number {
  if (m <= 0) return tarifaCheia * (1 - desconto)
  const inflacaoMensal = toMonthly(inflacaoAa)
  const fatorCrescimento = Math.pow(1 + inflacaoMensal, Math.max(0, m - 1))
  return tarifaCheia * fatorCrescimento * (1 - desconto)
}

/**
 * Ajusta o kc contratado reduzindo proporcionalmente pela entrada.
 * A limitação garante que o valor nunca exceda os limites contratuais.
 */
export function kcAjustadoPorEntrada(
  kcKwhMes: number,
  tarifaCheia: number,
  desconto: number,
  prazoMeses: number,
  entradaRs: number,
): number {
  if (kcKwhMes <= 0) return 0
  if (entradaRs <= 0 || prazoMeses <= 0) return Math.max(0, kcKwhMes)

  const denominador = kcKwhMes * tarifaCheia * (1 - desconto) * prazoMeses
  if (denominador <= 0) return Math.max(0, kcKwhMes)
  const fracaoReducao = Math.min(1, Math.max(0, entradaRs / denominador))
  return Math.max(0, kcKwhMes * (1 - fracaoReducao))
}

/**
 * Distribui o valor de entrada como crédito mensal uniforme.
 * Evitamos duplicidade de lógica ao centralizar o rateio.
 */
export function creditoMensal(entradaRs: number, prazoMeses: number): number {
  if (entradaRs <= 0 || prazoMeses <= 0) return 0
  return entradaRs / prazoMeses
}

export interface MensalidadeLiquidaInput {
  kcKwhMes: number
  tarifaCheia: number
  desconto: number
  inflacaoAa: number
  m: number
  taxaMinima: number
  encargosFixos: number
  entradaRs: number
  prazoMeses: number
  modoEntrada: EntradaModo
}

/**
 * Calcula a mensalidade líquida para o mês m.
 * A projeção soma a energia contratada às margens fixas (taxa mínima + encargos)
 * antes de considerar o eventual crédito da entrada.
 */
export function mensalidadeLiquida({
  kcKwhMes,
  tarifaCheia,
  desconto,
  inflacaoAa,
  m,
  taxaMinima,
  encargosFixos,
  entradaRs,
  prazoMeses,
  modoEntrada,
}: MensalidadeLiquidaInput): number {
  if (m <= 0 || prazoMeses <= 0) return 0

  const kcContratado =
    modoEntrada === 'REDUZ'
      ? kcAjustadoPorEntrada(kcKwhMes, tarifaCheia, desconto, prazoMeses, entradaRs)
      : Math.max(0, kcKwhMes)

  const tarifaComDesconto = tarifaDescontada(tarifaCheia, desconto, inflacaoAa, m)
  const energiaComDesconto = Math.max(0, kcContratado * tarifaComDesconto)
  const encargosAdicionais = Math.max(0, encargosFixos)
  const taxaMinimaPositiva = Math.max(0, taxaMinima)
  const margemMinima = taxaMinimaPositiva + encargosAdicionais
  const valorBase = energiaComDesconto + margemMinima

  const credito =
    modoEntrada === 'CREDITO'
      ? creditoMensal(entradaRs, prazoMeses)
      : 0

  const resultado = Math.max(0, valorBase - credito)
  return Number.isFinite(resultado) ? resultado : 0
}

export interface CustosRestantesInput {
  m: number
  prazoMeses: number
  custosFixosM: number
  opexM: number
  seguroM: number
  ipcaAa: number
}

/**
 * Projeta custos remanescentes do mês m até o fim do prazo com IPCA composto.
 * Mantém uma única fonte de verdade para custos indiretos do buyout.
 */
export function custosRestantes({
  m,
  prazoMeses,
  custosFixosM,
  opexM,
  seguroM,
  ipcaAa,
}: CustosRestantesInput): number {
  if (m > prazoMeses) return 0
  const custoBase = Math.max(0, custosFixosM + opexM + seguroM)
  if (custoBase === 0) return 0

  const ipcaMensal = toMonthly(ipcaAa)
  let total = 0
  const inicio = Math.max(1, m)
  for (let mes = inicio; mes <= prazoMeses; mes += 1) {
    const fator = Math.pow(1 + ipcaMensal, mes - inicio)
    total += custoBase * fator
  }
  return total
}

export interface ValorReposicaoInput {
  vm0: number
  depreciacaoAa: number
  m: number
}

/**
 * Calcula o valor de reposição depreciado até o mês m.
 * O piso evita valores negativos mesmo com taxas elevadas.
 */
export function valorReposicao({
  vm0,
  depreciacaoAa,
  m,
}: ValorReposicaoInput): number {
  if (m <= 0) return Math.max(0, vm0)
  const depMensal = toMonthly(depreciacaoAa)
  const fatorSobrevivencia = Math.max(0, 1 - depMensal)
  return Math.max(0, vm0) * Math.pow(fatorSobrevivencia, m)
}

export function creditoCashback(cashbackPct: number, pagosAcumAteM: number): number {
  if (!Number.isFinite(cashbackPct) || !Number.isFinite(pagosAcumAteM)) return 0
  if (cashbackPct <= 0 || pagosAcumAteM <= 0) return 0
  return cashbackPct * pagosAcumAteM
}

function valorCompraBase({
  m,
  vm0,
  depreciacaoAa,
  ipcaAa,
  inadimplenciaAa,
  tributosAa,
  custosFixosM,
  opexM,
  seguroM,
  pagosAcumAteM,
  cashbackPct,
  duracaoMeses,
}: ValorCompraClienteInput): number {
  if (m < 7 || m >= duracaoMeses) return 0

  const valorReposicaoMes = valorReposicao({ vm0, depreciacaoAa, m })
  const custos = custosRestantes({
    m,
    prazoMeses: duracaoMeses,
    custosFixosM,
    opexM,
    seguroM,
    ipcaAa,
  })
  const fatorGross = grossUp({ inadimplenciaAa, tributosAa })
  const cashback = creditoCashback(cashbackPct, pagosAcumAteM)
  return (valorReposicaoMes + custos) * fatorGross - cashback
}

export interface GrossUpInput {
  inadimplenciaAa: number
  tributosAa: number
}

/**
 * Determina o fator de gross-up frente a inadimplência e tributos anuais.
 * Mantemos a multiplicação separada para facilitar auditorias.
 */
export function grossUp({ inadimplenciaAa, tributosAa }: GrossUpInput): number {
  const inadMensal = toMonthly(inadimplenciaAa)
  const tribMensal = toMonthly(tributosAa)
  const denominador = (1 - inadMensal) * (1 - tribMensal)
  if (denominador <= 0) return 1
  return 1 / denominador
}

export interface ValorCompraClienteInput {
  m: number
  vm0: number
  depreciacaoAa: number
  ipcaAa: number
  inadimplenciaAa: number
  tributosAa: number
  custosFixosM: number
  opexM: number
  seguroM: number
  pagosAcumAteM: number
  cashbackPct: number
  duracaoMeses: number
}

/**
 * Calcula o valor de compra do cliente no mês m considerando risco e cashback.
 * Assegura coerência entre telas ao centralizar toda a lógica contratual.
 */
export function valorCompraCliente({
  m,
  vm0,
  depreciacaoAa,
  ipcaAa,
  inadimplenciaAa,
  tributosAa,
  custosFixosM,
  opexM,
  seguroM,
  pagosAcumAteM,
  cashbackPct,
  duracaoMeses,
}: ValorCompraClienteInput): number {
  const base = valorCompraBase({
    m,
    vm0,
    depreciacaoAa,
    ipcaAa,
    inadimplenciaAa,
    tributosAa,
    custosFixosM,
    opexM,
    seguroM,
    pagosAcumAteM,
    cashbackPct,
    duracaoMeses,
  })
  if (base <= 0) return 0
  const arredondado = Math.round(base * 100) / 100
  return arredondado > 0 ? arredondado : 0
}

export function valorCompraClienteLinear({ duracaoMeses, ...rest }: ValorCompraClienteInput): number {
  const inicio = 7
  const mes = rest.m
  if (mes >= duracaoMeses) return 0
  if (duracaoMeses <= inicio) return 0
  if (mes < inicio) return 0

  const valorNoInicio = valorCompraCliente({ ...rest, duracaoMeses, m: inicio })
  if (valorNoInicio <= 0) return 0

  const fator = (duracaoMeses - mes) / (duracaoMeses - inicio)
  if (fator <= 0) return 0

  const valor = Math.max(0, valorNoInicio * fator)
  const arredondado = Math.round(valor * 100) / 100
  return arredondado > 0 ? arredondado : 0
}
