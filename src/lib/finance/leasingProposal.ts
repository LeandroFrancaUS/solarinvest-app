/**
 * Funções puras para a proposta impressa de leasing.
 * Extraídas de PrintableProposalLeasing.tsx para torná-las testáveis independentemente.
 *
 * NOTA SOBRE MODELO DE INFLAÇÃO (F02 / F09):
 * A tabela de mensalidades usa Modelo A (reajuste por índice anual: fator = (1+inf)^(ano-1)).
 * Isso é intencional — a proposta apresenta dados anuais discretos.
 * O motor de simulação mensal (calcs.ts::tarifaProjetadaCheia) usa Modelo C (aniversário).
 * A diferença pode chegar a 2–4% em 5 anos com inflação de 10%, mas é aceitável
 * para exibição anual na proposta (dados de apresentação, não de contrato).
 * Para cálculos financeiros precisos use o motor mensal.
 *
 * @see PrintableProposalLeasing.tsx
 * @see src/lib/finance/calculations.ts (calcularTarifaProjetada — equivalente ao Modelo A)
 * @see src/utils/calcs.ts (tarifaProjetadaCheia — Modelo C, aniversário)
 */

export interface MensalidadePorAno {
  ano: number
  tarifaCheiaAno: number
  tarifaComDesconto: number
  mensalidadeSolarInvest: number
  mensalidadeDistribuidora: number
  encargosDistribuidora: number
  despesaMensalEstimada: number
}

export interface MensalidadesPorAnoParams {
  prazoContratualTotalAnos: number
  tarifaCheiaBase: number
  inflacaoEnergiaFracao: number
  descontoFracao: number
  energiaContratadaBase: number
  custosFixosContaEnergia: number
  taxaMinimaMensal: number
  /** Mapa ano → TUSD médio mensal naquele ano (R$) */
  tusdMedioPorAno: Record<number, number | undefined>
}

/**
 * Calcula a tabela de mensalidades para cada ano do contrato de leasing,
 * mais um ano pós-contrato.
 *
 * Usa Modelo A de inflação: fator = (1 + inf)^(ano - 1).
 * Equivale a calcularTarifaProjetada(tarifaBase, inf, ano - 1) de calculations.ts.
 */
export function calcMensalidadesPorAno(params: MensalidadesPorAnoParams): MensalidadePorAno[] {
  const {
    prazoContratualTotalAnos,
    tarifaCheiaBase,
    inflacaoEnergiaFracao,
    descontoFracao,
    energiaContratadaBase,
    custosFixosContaEnergia,
    taxaMinimaMensal,
    tusdMedioPorAno,
  } = params

  // Limita deflação extrema: (1 + inflacao) deve ser >= 0.01 para evitar fatores de composto
  // próximos de zero ou negativos, que resultariam em tarifas absurdas ou divisão por zero.
  const safeInflacao = Math.max(-0.99, inflacaoEnergiaFracao)
  const anosConsiderados = Array.from({ length: prazoContratualTotalAnos }, (_, i) => i + 1)

  const linhas: MensalidadePorAno[] = anosConsiderados.map((ano) => {
    const fator = Math.pow(1 + safeInflacao, Math.max(0, ano - 1))
    const tarifaAno = tarifaCheiaBase * fator
    const tarifaComDesconto = tarifaAno * (1 - descontoFracao)
    const tusdMedio = tusdMedioPorAno[ano] ?? 0
    const mensalidadeSolarInvest = energiaContratadaBase * tarifaComDesconto
    const mensalidadeDistribuidora = energiaContratadaBase * tarifaAno + custosFixosContaEnergia
    const encargosDistribuidora = tusdMedio + taxaMinimaMensal
    const despesaMensalEstimada = mensalidadeSolarInvest + encargosDistribuidora
    return {
      ano,
      tarifaCheiaAno: tarifaAno,
      tarifaComDesconto,
      mensalidadeSolarInvest,
      mensalidadeDistribuidora,
      encargosDistribuidora,
      despesaMensalEstimada,
    }
  })

  // Determine TUSD pós-contrato usando o último valor disponível dentro do prazo
  const anosTusdOrdenados = Object.keys(tusdMedioPorAno)
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)

  let tusdPosContrato = 0
  for (let i = anosTusdOrdenados.length - 1; i >= 0; i -= 1) {
    const ano = anosTusdOrdenados[i] as number
    if (ano <= prazoContratualTotalAnos) {
      const valorTusd = tusdMedioPorAno[ano]
      if (Number.isFinite(valorTusd)) {
        tusdPosContrato = Math.max(0, valorTusd ?? 0)
        break
      }
    }
  }

  const anoPosContrato = prazoContratualTotalAnos + 1
  const fatorPosContrato = Math.pow(1 + safeInflacao, Math.max(0, anoPosContrato - 1))
  const tarifaAnoPosContrato = tarifaCheiaBase * fatorPosContrato
  const mensalidadeDistribuidoraPosContrato = energiaContratadaBase * tarifaAnoPosContrato + custosFixosContaEnergia
  const encargosDistribuidoraPosContrato = Math.max(0, tusdPosContrato + taxaMinimaMensal)
  const despesaMensalPosContrato = encargosDistribuidoraPosContrato

  linhas.push({
    ano: anoPosContrato,
    tarifaCheiaAno: tarifaAnoPosContrato,
    tarifaComDesconto: 0,
    encargosDistribuidora: encargosDistribuidoraPosContrato,
    mensalidadeSolarInvest: 0,
    mensalidadeDistribuidora: mensalidadeDistribuidoraPosContrato,
    despesaMensalEstimada: despesaMensalPosContrato,
  })

  return linhas
}

/**
 * Retorna o benefício acumulado do leasing no ano especificado.
 * O `leasingROI` é um array onde índice 0 = benefício acumulado no ano 1.
 */
export function obterBeneficioPorAno(leasingROI: number[], ano: number): number {
  if (!Array.isArray(leasingROI) || leasingROI.length === 0) return 0
  if (!Number.isFinite(ano) || ano <= 0) return 0
  const totalAnos = leasingROI.length
  const indice = Math.min(totalAnos, Math.max(1, Math.ceil(ano))) - 1
  return leasingROI[indice] ?? 0
}

/**
 * Calcula o benefício total até o ano especificado, opcionalmente somando
 * o valor de mercado da usina ao fim do contrato.
 */
export function calcEconomiaTotalAteAno(
  leasingROI: number[],
  ano: number,
  prazoContratualAnos: number,
  valorMercadoUsina: number,
): number {
  if (!Number.isFinite(ano) || ano <= 0) return 0
  const beneficioBase = obterBeneficioPorAno(leasingROI, ano)
  const deveAdicionarUsina = valorMercadoUsina > 0 && prazoContratualAnos > 0 && ano >= prazoContratualAnos
  return Math.max(0, deveAdicionarUsina ? beneficioBase + valorMercadoUsina : beneficioBase)
}
