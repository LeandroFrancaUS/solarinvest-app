/**
 * Análise financeira do buyout (transferência antecipada) no leasing solar.
 *
 * Calcula:
 *  - `calcularEconomiaFuturaBuyout`: economia energética projetada após o buyout,
 *    corrigida pela inflação energética anual (ex.: 4% a.a.).
 *  - `analisarBuyout`: encontra o melhor mês para o buyout (meses 7–36 por padrão)
 *    e gera uma tabela de ROI em intervalos de 6 meses (7, 13, 19, 25, 31, 37, 43, 45).
 *
 * As mensalidades pagas até o mês do buyout já reduzem o valor de compra via cashback,
 * conforme implementado em `valorCompraCliente` (utils/calcs.ts). Esta análise utiliza
 * o `valorResidual` (já líquido do cashback) e as `prestacaoAcum` da tabela calculada.
 */

import type { BuyoutRow } from '../../types/printableProposal'

/** Meses padrão para análise de ROI do buyout: 7º ao 45º em intervalos de 6 meses. */
export const MESES_ROI_BUYOUT_PADRAO: readonly number[] = [7, 13, 19, 25, 31, 37, 43, 45]

/** Vida útil padrão do sistema fotovoltaico em meses (25 anos = 300 meses). */
export const VIDA_UTIL_PADRAO_MESES = 300

/** Limite padrão de meses para a busca do melhor mês de buyout. */
export const LIMITE_MELHOR_MES_PADRAO = 36

export interface BuyoutRoiPonto {
  /** Mês de referência do buyout. */
  mes: number
  /** Valor de compra (transferência antecipada) estimado nesse mês, após dedução do cashback. */
  valorResidual: number
  /** Prestações acumuladas pagas pelo cliente até esse mês. */
  prestacaoAcum: number
  /** Investimento total = prestações acumuladas + valor de compra. */
  totalInvestido: number
  /**
   * Economia energética projetada do mês seguinte até o fim da vida útil,
   * corrigida pela inflação energética (ex.: 4% a.a.).
   */
  economiaFutura: number
  /**
   * ROI = economiaFutura / totalInvestido − 1.
   * Exemplo: 2.5 equivale a 250%.
   */
  roi: number
}

export interface BuyoutAnalise {
  /** Mês com o maior ROI dentro do limite pesquisado (padrão: meses 7–36). */
  melhorMes: number | null
  /** Valor de compra no melhor mês. */
  melhorMesValorResidual: number
  /** Investimento total (prestações + valor de compra) no melhor mês. */
  melhorMesTotalInvestido: number
  /** ROI no melhor mês. */
  melhorMesRoi: number
  /** Tabela de ROI nos meses solicitados (padrão: 7, 13, 19, 25, 31, 37, 43, 45). */
  roiPorMes: BuyoutRoiPonto[]
}

/**
 * Calcula a soma da economia energética projetada após o buyout realizado no mês `mesInicio`.
 *
 * A tarifa base (do mês do buyout) é reajustada mensalmente pela inflação energética anual,
 * acumulando a economia mês a mês até o fim da vida útil do sistema.
 *
 * @param mesInicio     Mês em que ocorre o buyout (1-based).
 * @param tarifaBase    Tarifa cheia projetada no mês do buyout (R$/kWh).
 * @param geracaoKwhMes Geração mensal do sistema (kWh/mês).
 * @param inflacaoAa    Inflação energética anual (ex.: 0.04 = 4%). Mínimo: −50%.
 * @param vidaUtilMeses Vida útil total do sistema a partir do mês 1 (padrão: 300 meses).
 */
export function calcularEconomiaFuturaBuyout(
  mesInicio: number,
  tarifaBase: number,
  geracaoKwhMes: number,
  inflacaoAa: number,
  vidaUtilMeses = VIDA_UTIL_PADRAO_MESES,
): number {
  if (
    !Number.isFinite(mesInicio) ||
    mesInicio < 0 ||
    !Number.isFinite(tarifaBase) ||
    tarifaBase <= 0 ||
    !Number.isFinite(geracaoKwhMes) ||
    geracaoKwhMes <= 0 ||
    !Number.isFinite(inflacaoAa) ||
    !Number.isFinite(vidaUtilMeses) ||
    vidaUtilMeses <= mesInicio
  ) {
    return 0
  }

  const n = vidaUtilMeses - mesInicio
  const inflacaoAnualNorm = Math.max(-0.5, inflacaoAa)
  const inflacaoMensal = Math.pow(1 + inflacaoAnualNorm, 1 / 12) - 1

  // Soma geométrica: Σ_{k=1}^{n} (1 + inflacaoMensal)^k
  let fatorAcumulado: number
  if (Math.abs(inflacaoMensal) < 1e-10) {
    fatorAcumulado = n
  } else {
    const r = 1 + inflacaoMensal
    fatorAcumulado = (r * (1 - Math.pow(r, n))) / (1 - r)
  }

  return geracaoKwhMes * tarifaBase * fatorAcumulado
}

/**
 * Analisa os meses do buyout:
 *  - Encontra o **melhor mês** (maior ROI) dentro do intervalo [7, limiteMelhorMes].
 *  - Gera a **tabela de ROI** para os meses solicitados.
 *
 * O ROI é definido como:
 *   `ROI(m) = economiaFutura(m) / (prestacaoAcum(m) + valorResidual(m)) − 1`
 *
 * onde `economiaFutura(m)` é a soma da economia energética projetada após o mês m
 * até o fim da vida útil do sistema, corrigida pela inflação energética anual.
 *
 * As mensalidades pagas até o buyout já estão embutidas na redução do `valorResidual`
 * via cashback, conforme calculado em `selectBuyoutLinhas` / `valorCompraCliente`.
 *
 * @param tabelaBuyout      Linhas da tabela de buyout calculadas pelo `selectBuyoutLinhas`.
 * @param geracaoKwhMes     Geração mensal do sistema (kWh/mês).
 * @param inflacaoAa        Inflação energética anual (ex.: 0.04 = 4%).
 * @param limiteMelhorMes   Mês máximo para a busca do melhor mês (padrão: 36).
 * @param mesesRoi          Meses específicos para o cálculo de ROI (padrão: MESES_ROI_BUYOUT_PADRAO).
 * @param vidaUtilMeses     Vida útil total do sistema em meses (padrão: 300).
 */
export function analisarBuyout({
  tabelaBuyout,
  geracaoKwhMes,
  inflacaoAa,
  limiteMelhorMes = LIMITE_MELHOR_MES_PADRAO,
  mesesRoi = MESES_ROI_BUYOUT_PADRAO,
  vidaUtilMeses = VIDA_UTIL_PADRAO_MESES,
}: {
  tabelaBuyout: BuyoutRow[]
  geracaoKwhMes: number
  inflacaoAa: number
  limiteMelhorMes?: number
  mesesRoi?: readonly number[]
  vidaUtilMeses?: number
}): BuyoutAnalise {
  const linhasPorMes = new Map<number, BuyoutRow>()
  for (const row of tabelaBuyout) {
    if (Number.isFinite(row.mes) && row.mes > 0) {
      linhasPorMes.set(row.mes, row)
    }
  }

  const calcularPonto = (mes: number): BuyoutRoiPonto | null => {
    const row = linhasPorMes.get(mes)
    if (
      !row ||
      row.valorResidual == null ||
      !Number.isFinite(row.valorResidual) ||
      row.valorResidual <= 0
    ) {
      return null
    }
    if (!Number.isFinite(row.prestacaoAcum) || row.prestacaoAcum < 0) {
      return null
    }

    const totalInvestido = row.prestacaoAcum + row.valorResidual
    if (totalInvestido <= 0) return null

    const economiaFutura = calcularEconomiaFuturaBuyout(
      mes,
      row.tarifa,
      geracaoKwhMes,
      inflacaoAa,
      vidaUtilMeses,
    )

    // Sem geração, não há economia futura e o ROI não é significativo
    if (economiaFutura <= 0) return null

    const roi = economiaFutura / totalInvestido - 1

    return {
      mes,
      valorResidual: row.valorResidual,
      prestacaoAcum: row.prestacaoAcum,
      totalInvestido,
      economiaFutura,
      roi,
    }
  }

  // Encontrar o melhor mês (maior ROI) no intervalo [7, limiteMelhorMes]
  let melhorMes: number | null = null
  let melhorRoi = -Infinity
  let melhorPonto: BuyoutRoiPonto | null = null

  for (let m = 7; m <= limiteMelhorMes; m += 1) {
    const ponto = calcularPonto(m)
    if (ponto && ponto.roi > melhorRoi) {
      melhorRoi = ponto.roi
      melhorMes = m
      melhorPonto = ponto
    }
  }

  // Calcular ROI para os meses solicitados
  const roiPorMes: BuyoutRoiPonto[] = []
  for (const m of mesesRoi) {
    const ponto = calcularPonto(m)
    if (ponto) {
      roiPorMes.push(ponto)
    }
  }

  return {
    melhorMes,
    melhorMesValorResidual: melhorPonto?.valorResidual ?? 0,
    melhorMesTotalInvestido: melhorPonto?.totalInvestido ?? 0,
    melhorMesRoi: melhorPonto?.roi ?? 0,
    roiPorMes,
  }
}
