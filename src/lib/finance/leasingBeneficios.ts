/**
 * Motor de benefícios anuais do leasing — SolarInvest.
 *
 * SEMÂNTICA IMPORTANTE:
 * O valor retornado por `calcLeasingBeneficios` é um benefício composto que mistura
 * duas perspectivas distintas:
 *
 * 1. `economiaEnergia` (perspectiva do CLIENTE)
 *    — Diferença anual entre o que o cliente pagaria sem o sistema e o que paga com ele.
 *    — Inclui: contaEnergia sem solar − (mensalidadeSolarInvest + encargosFixos + TUSD)
 *
 * 2. `beneficioOpex` (perspectiva SOLARINVEST)
 *    — OPEX que a SolarInvest absorve por ter o sistema instalado.
 *    — Estimado como: valorInvestimento × 1,5% a.a. durante o contrato.
 *
 * 3. `beneficioInvestimento` (perspectiva SOLARINVEST)
 *    — Diluição anual do capital investido: valorInvestimento / prazoAnos
 *
 * A soma dos três componentes é usada no leasing ROI acumulado exibido na proposta.
 * Para apresentar somente a perspectiva do cliente, use apenas `economiaEnergia`.
 *
 * @see src/App.tsx — leasingBeneficios useMemo (origem deste cálculo)
 */

import { calcTusdEncargoMensal } from './tusd'
import type { TipoClienteTUSD } from './tusd'

export const LEASING_OPEX_ANUAL_FRAC = 0.015  // 1,5% do CAPEX por ano

export interface LeasingBeneficiosParams {
  /** CAPEX da SolarInvest (investimento inicial) */
  capexSolarInvest: number
  /** Prazo total do contrato em anos */
  prazoAnos: number
  /** Consumo mensal contratado (kWh/mês) */
  kcKwhMes: number
  /** Taxa de desconto sobre a tarifa cheia (fração 0–1) */
  desconto: number
  /** Tarifa cheia no mês 1 (R$/kWh) */
  tarifaCheia: number
  /** Inflação energética anual (fração) */
  inflacaoAa: number
  /** Mês de referência contratual para reajuste aniversário */
  mesReferencia: number
  /** Mês do reajuste anual */
  mesReajuste: number
  /** Taxa mínima mensal (R$) — 0 se não aplicável */
  taxaMinima: number
  /** Encargos fixos mensais (R$) */
  encargosFixos: number
  /** Aplica taxa mínima no período dentro do contrato */
  aplicaTaxaMinima: boolean
  /** Consumo mínimo CID (kWh) */
  cidKwhBase: number
  /** Número total de anos para calcular (normalmente ANALISE_ANOS_PADRAO = 30) */
  totalAnos: number
  /** Config TUSD */
  tusd: {
    tipoCliente?: TipoClienteTUSD | null
    subtipo?: string | null
    percentual?: number | null
    simultaneidade?: number | null
    tarifaRkwh?: number | null
    anoReferencia?: number | null
  }
  /** Funções de projeção de tarifa (injetadas para desacoplar de calcs.ts) */
  tarifaProjetadaCheia: (tarifaCheia: number, inflacao: number, mes: number, mesReajuste: number, mesReferencia: number) => number
  tarifaDescontada: (tarifaCheia: number, desconto: number, inflacao: number, mes: number, mesReajuste: number, mesReferencia: number) => number
  calcularTaxaMinima: (tarifa: number) => number
}

export interface LeasingBeneficioAnual {
  ano: number
  /** Economia de energia para o cliente neste ano (R$) */
  economiaEnergia: number
  /** Benefício OPEX absorvido pela SolarInvest neste ano (R$) — perspectiva SolarInvest */
  beneficioOpex: number
  /** Diluição anual do investimento (R$) — perspectiva SolarInvest */
  beneficioInvestimento: number
  /** Benefício composto total (soma dos três componentes) */
  beneficioTotal: number
  /** Se este ano está dentro do prazo contratual */
  dentroPrazo: boolean
}

/**
 * Calcula os benefícios anuais compostos do leasing para `totalAnos` anos.
 *
 * @returns Array com `totalAnos` entradas, uma por ano.
 */
export function calcLeasingBeneficios(params: LeasingBeneficiosParams): LeasingBeneficioAnual[] {
  const {
    capexSolarInvest,
    prazoAnos,
    kcKwhMes,
    desconto,
    tarifaCheia,
    inflacaoAa,
    mesReferencia,
    mesReajuste,
    taxaMinima,
    encargosFixos,
    aplicaTaxaMinima,
    cidKwhBase,
    totalAnos,
    tusd,
    tarifaProjetadaCheia,
    tarifaDescontada,
    calcularTaxaMinima,
  } = params

  const valorInvestimento = Math.max(0, capexSolarInvest)
  const prazoLeasingValido = prazoAnos > 0 ? prazoAnos : null
  const economiaOpexAnual = prazoLeasingValido ? valorInvestimento * LEASING_OPEX_ANUAL_FRAC : 0
  const investimentoDiluirAnual = prazoLeasingValido ? valorInvestimento / prazoAnos : 0
  const contratoMeses = Math.max(0, Math.floor(prazoAnos * 12))

  return Array.from({ length: totalAnos }, (_, i) => {
    const ano = i + 1
    const inicioMes = (ano - 1) * 12 + 1
    const fimMes = inicioMes + 11
    let economiaEnergia = 0

    for (let mes = inicioMes; mes <= fimMes; mes += 1) {
      const tarifaCheiaMes = tarifaProjetadaCheia(tarifaCheia, inflacaoAa, mes, mesReajuste, mesReferencia)
      const tarifaDescontadaMes = tarifaDescontada(tarifaCheia, desconto, inflacaoAa, mes, mesReajuste, mesReferencia)
      const aplicaTaxaMinimaNoMes = aplicaTaxaMinima || mes > contratoMeses
      const encargosFixosAplicados = aplicaTaxaMinimaNoMes ? encargosFixos : 0
      const taxaMinimaMes = calcularTaxaMinima(tarifaCheiaMes)
      const taxaMinimaPositiva = Math.max(0, taxaMinima)
      const taxaMinimaAplicada = aplicaTaxaMinimaNoMes
        ? taxaMinimaPositiva > 0 ? taxaMinimaPositiva : taxaMinimaMes
        : 0
      const cidAplicado = aplicaTaxaMinimaNoMes ? cidKwhBase * tarifaCheiaMes : 0
      const custoSemSistemaMes = kcKwhMes * tarifaCheiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
      const dentroPrazoMes = contratoMeses > 0 ? mes <= contratoMeses : false
      const custoComSistemaEnergiaMes = dentroPrazoMes ? kcKwhMes * tarifaDescontadaMes : 0
      const custoComSistemaBaseMes = custoComSistemaEnergiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
      const tusdMes = aplicaTaxaMinimaNoMes
        ? calcTusdEncargoMensal({
            consumoMensal_kWh: kcKwhMes,
            tarifaCheia_R_kWh: tarifaCheiaMes,
            mes,
            ...(tusd.anoReferencia != null && { anoReferencia: tusd.anoReferencia }),
            ...(tusd.tipoCliente != null && { tipoCliente: tusd.tipoCliente }),
            ...(tusd.subtipo != null && { subTipo: tusd.subtipo }),
            ...(tusd.percentual != null && { pesoTUSD: tusd.percentual }),
            ...(tusd.tarifaRkwh != null && { tusd_R_kWh: tusd.tarifaRkwh }),
            ...(tusd.simultaneidade != null && { simultaneidadePadrao: tusd.simultaneidade }),
          })
        : 0
      economiaEnergia += custoSemSistemaMes - (custoComSistemaBaseMes + tusdMes)
    }

    const dentroPrazo = prazoLeasingValido ? ano <= prazoAnos : false
    const beneficioOpex = dentroPrazo ? economiaOpexAnual : 0
    const beneficioInvestimento = dentroPrazo ? investimentoDiluirAnual : 0
    const beneficioTotal = economiaEnergia + beneficioOpex + beneficioInvestimento

    return {
      ano,
      economiaEnergia,
      beneficioOpex,
      beneficioInvestimento,
      beneficioTotal,
      dentroPrazo,
    }
  })
}

/**
 * Calcula o ROI acumulado do leasing ano a ano.
 * Soma os `beneficioTotal` de cada ano progressivamente.
 *
 * @returns Array de benefícios acumulados por ano (índice 0 = ano 1).
 */
export function calcLeasingROI(beneficiosAnuais: LeasingBeneficioAnual[]): number[] {
  const acc: number[] = []
  let acumulado = 0
  for (const b of beneficiosAnuais) {
    acumulado += b.beneficioTotal
    acc.push(acumulado)
  }
  return acc
}
