/**
 * Módulo oficial e centralizado para cálculo do Valor de Exercício de Compra (VEC).
 *
 * Buyout contratual:
 * O valor de exercício de compra NÃO é reduzido por mensalidades pagas.
 * As mensalidades remuneram exclusivamente os serviços prestados.
 * O redutor do VEC decorre apenas da evolução econômica/técnica do ativo:
 * depreciação econômica, amortização técnica acumulada e piso residual mínimo.
 *
 * Premissa operacional:
 * O "Preço ideal" da Análise Financeira corresponde ao valor-base/original
 * do ativo no início do contrato (valorBaseOriginalAtivo).
 *
 * Fórmula contratual:
 *   VEC(m) = max(0, (VM × F(m)) – A(m))
 *   vecFinal = max(vecBase, pisoResidual(m))
 *
 * Onde:
 *   VM  = valorBaseOriginalAtivo — valor-base/original do ativo no início do contrato,
 *         correspondente ao "Preço ideal" da Análise Financeira.
 *   F(m) = Fator de Depreciação Econômica no mês contratual m.
 *   A(m) = Amortização técnica acumulada até o mês m (independente da mensalidade).
 *   m   = Mês contratual vigente.
 *
 * IMPORTANTE:
 * - Esta é a ÚNICA fonte oficial do cálculo de buyout.
 * - Toda tela, PDF, proposta, contrato e backend deve chamar computeContractualBuyout.
 * - O A(m) é amortização técnica do ativo — não usa mensalidade, PMT ou saldo financeiro.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BuyoutInputs {
  /** Mês contratual vigente (base 1: mês 1 = primeiro mês do contrato). */
  mesContratual: number
  /** Prazo total do contrato em meses (ex.: 60). */
  prazoContratualMeses: number
  /**
   * VM — Valor-base/original do ativo no início do contrato.
   * Deve ser o "Preço ideal" da Análise Financeira (precoIdeal / custoFinalProjetadoCanonico).
   * É também a base para o piso residual mínimo.
   * NÃO é mensalidade, NÃO é CAPEX do PDF, NÃO é reduzido por parcelas pagas.
   */
  valorBaseOriginalAtivo: number
  /**
   * F(m) — Fator de Depreciação Econômica no mês m.
   * Deve ser um número em [0, 1]. Use computeDepreciationFactor para calculá-lo
   * a partir da taxa de depreciação anual.
   */
  fatorDepreciacaoEconomica: number
  /**
   * A(m) — Amortização técnica acumulada até o mês m.
   * Deve ser calculada sobre o valor do ativo, independente da mensalidade.
   * Use computeLinearTechnicalAmortization para amortização linear, ou forneça
   * outro modelo auditável.
   */
  amortizacaoTecnicaAcumulada: number
}

export interface BuyoutBreakdown {
  /** Resultado base da fórmula: max(0, VM × F(m) – A(m)). */
  vecBase: number
  /** Percentual de piso residual mínimo aplicável no mês m. */
  pisoResidualPct: number
  /** Valor absoluto do piso residual mínimo aplicável no mês m (em R$). */
  pisoResidualValor: number
  /** Valor final: max(vecBase, pisoResidualValor). */
  vecFinal: number
  /** Memória de cálculo para auditoria, exibição interna e rastreabilidade jurídica. */
  memoriaCalculo: {
    /** VM = valorBaseOriginalAtivo = Preço ideal da Análise Financeira. */
    vm: number
    /** F(m) = Fator de depreciação econômica. */
    f: number
    /** A(m) = Amortização técnica acumulada (independente de mensalidades). */
    a: number
    mesContratual: number
    prazoContratualMeses: number
  }
}

// ─── Piso Residual ────────────────────────────────────────────────────────────

/**
 * Retorna o percentual de piso residual mínimo aplicável no mês contratual m.
 *
 * Interpretação operacional da cláusula contratual de valor mínimo de exercício:
 *   - m < 6  : 0 (opção de compra não exercível; o contrato impede o exercício antes do mês 6)
 *   - m 6–24 : 40% do valor original do ativo (piso fixo)
 *   - m 25–prazo: redução linear de 40% até 10% (progressão por faixa)
 *   - Clamped: sempre entre 10% e 40% para m ≥ 6
 *
 * NOTA JURÍDICA: A curva progressiva entre o mês 25 e o mês final do prazo é
 * uma interpretação operacional linear desta cláusula. Caso haja entendimento
 * jurídico diferente (ex.: tabela price, curva exponencial), alterar SOMENTE
 * esta função e os testes correspondentes. O restante do sistema permanece
 * inalterado.
 *
 * @param m     Mês contratual vigente (base 1).
 * @param prazo Prazo total do contrato em meses.
 * @returns Percentual decimal [0, 0.40].
 */
export function getResidualFloorPct(m: number, prazo: number): number {
  if (m < 6) return 0
  if (m <= 24) return 0.4

  // Faixa progressiva: mês 25 até o prazo final.
  // Garante denominador > 0 para prazo ≤ 25.
  const prazoEfetivo = Math.max(26, prazo)
  const progress = (m - 25) / (prazoEfetivo - 25)
  const pct = 0.4 - progress * 0.3
  return Math.max(0.1, Math.min(0.4, pct))
}

/**
 * Retorna o valor absoluto do piso residual mínimo em R$ para o mês m.
 *
 * @param m                    Mês contratual vigente (base 1).
 * @param valorBaseOriginalAtivo Valor-base/original do ativo (= Preço ideal da Análise Financeira).
 * @param prazo                Prazo total do contrato em meses.
 * @returns Valor em R$.
 */
export function getResidualFloorValue(
  m: number,
  valorBaseOriginalAtivo: number,
  prazo: number,
): number {
  const pct = getResidualFloorPct(m, prazo)
  return Math.max(0, valorBaseOriginalAtivo) * pct
}

// ─── Helpers de cálculo de F(m) e A(m) ──────────────────────────────────────

/**
 * Calcula o Fator de Depreciação Econômica F(m) usando capitalização composta mensal.
 *
 * F(m) = (1 − δ_mensal)^m, onde δ_mensal = (1 + depreciacaoAa)^(1/12) − 1.
 *
 * @param depreciacaoAa Taxa de depreciação anual em decimal (ex.: 0.12 para 12% a.a.).
 * @param m             Mês contratual (base 1).
 * @returns Fator em [0, 1].
 */
export function computeDepreciationFactor(depreciacaoAa: number, m: number): number {
  if (m <= 0) return 1
  const taxaAa = Math.max(0, depreciacaoAa)
  const depMensal = Math.pow(1 + taxaAa, 1 / 12) - 1
  return Math.pow(Math.max(0, 1 - depMensal), m)
}

/**
 * Calcula a Amortização Técnica Acumulada A(m) pelo método linear.
 *
 * A(m) = valorBaseOriginalAtivo × m / prazoContratualMeses
 *
 * Esta amortização é:
 * - Baseada no valor do ativo (não na mensalidade de serviço)
 * - Independente de juros, PMT ou financiamento do cliente
 * - Auditável e previsível ao longo do contrato
 *
 * NOTA: Se o contrato especificar outro método de amortização técnica
 * (ex.: soma dos dígitos, exponencial), substituir esta função mantendo
 * a mesma assinatura.
 *
 * @param valorBaseOriginalAtivo Valor-base/original do ativo (= Preço ideal da Análise Financeira).
 * @param m                      Mês contratual (base 1).
 * @param prazoContratualMeses   Prazo total do contrato em meses.
 * @returns Valor em R$.
 */
export function computeLinearTechnicalAmortization(
  valorBaseOriginalAtivo: number,
  m: number,
  prazoContratualMeses: number,
): number {
  if (prazoContratualMeses <= 0 || m <= 0) return 0
  const mEfetivo = Math.min(m, prazoContratualMeses)
  return Math.max(0, valorBaseOriginalAtivo) * (mEfetivo / prazoContratualMeses)
}

// ─── Cálculo Principal ───────────────────────────────────────────────────────

/**
 * Calcula o Valor de Exercício de Compra (VEC) conforme a fórmula contratual.
 *
 * Fórmula: VEC(m) = max(0, (VM × F(m)) – A(m))
 * Piso:    vecFinal = max(vecBase, pisoResidual(m, valorBaseOriginalAtivo, prazo))
 *
 * Esta função é a ÚNICA fonte oficial do cálculo de buyout. Todos os pontos
 * do sistema (UI, PDF, proposta, contrato, backend, store) devem chamar esta
 * função diretamente ou via seletor que a encapsula.
 *
 * @param input Parâmetros de entrada conforme BuyoutInputs.
 * @returns     Breakdown completo com vecFinal, vecBase, piso e memória de cálculo.
 */
export function computeContractualBuyout(input: BuyoutInputs): BuyoutBreakdown {
  const {
    mesContratual: m,
    prazoContratualMeses,
    valorBaseOriginalAtivo,
    fatorDepreciacaoEconomica,
    amortizacaoTecnicaAcumulada,
  } = input

  // VM = valorBaseOriginalAtivo = Preço ideal da Análise Financeira
  const vm = Math.max(0, valorBaseOriginalAtivo)
  const f = Math.max(0, Math.min(1, fatorDepreciacaoEconomica))
  const a = Math.max(0, amortizacaoTecnicaAcumulada)

  // Fórmula base: VEC = max(0, VM × F(m) − A(m))
  const vecRaw = vm * f - a
  const vecBase = Math.max(0, vecRaw)

  // Piso residual mínimo contratual
  const pisoResidualPct = getResidualFloorPct(m, prazoContratualMeses)
  const pisoResidualValor = vm * pisoResidualPct

  // Valor final: nunca abaixo do piso
  const vecFinal = Math.max(vecBase, pisoResidualValor)

  return {
    vecBase,
    pisoResidualPct,
    pisoResidualValor,
    vecFinal,
    memoriaCalculo: {
      vm,
      f,
      a,
      mesContratual: m,
      prazoContratualMeses,
    },
  }
}
