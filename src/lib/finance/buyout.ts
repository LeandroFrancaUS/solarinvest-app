/**
 * Módulo oficial e centralizado para cálculo do Valor de Exercício de Compra (VEC).
 *
 * Fórmula contratual:
 *   VEC(m) = max(0, (VM × F(m)) – A(m))
 *   vecFinal = max(vecBase, pisoResidual(m))
 *
 * Onde:
 *   VM  = Valor de Mercado da Usina — proveniente da Análise Financeira / Preço ideal.
 *   F(m) = Fator de Depreciação Econômica no mês contratual m.
 *   A(m) = Amortização técnica acumulada até o mês m (independente da mensalidade).
 *   m   = Mês contratual vigente.
 *
 * IMPORTANTE:
 * - Esta é a ÚNICA fonte oficial do cálculo de buyout.
 * - Toda tela, PDF, proposta, contrato e backend deve chamar computeContractualBuyout.
 * - O VM deve vir sempre da engine da Análise Financeira (campo precoIdeal / custoFinalProjetadoCanonico).
 * - O A(m) é amortização técnica do ativo — não usa mensalidade, PMT ou saldo financeiro.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BuyoutInputs {
  /** Mês contratual vigente (base 1: mês 1 = primeiro mês do contrato). */
  mesContratual: number
  /** Prazo total do contrato em meses (ex.: 60). */
  prazoContratualMeses: number
  /**
   * VM — Valor de Mercado da Usina.
   * Deve ser extraído da engine da Análise Financeira (Preço ideal / precoIdeal).
   * Alimenta também a tag {{valordemercado_atual}} nos contratos.
   */
  valorMercadoUsina: number
  /**
   * Valor original do ativo no momento zero do contrato.
   * Usado como base para o piso residual e para a amortização técnica linear.
   * Geralmente igual ao VM inicial (vm0).
   */
  valorOriginalAtivo: number
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
  /** Piso residual mínimo aplicável no mês m (em R$). */
  pisoResidualAplicado: number
  /** Valor final: max(vecBase, pisoResidualAplicado). */
  vecFinal: number
  /** Memória de cálculo para auditoria, exibição interna e rastreabilidade jurídica. */
  memoriaCalculo: {
    vm: number
    f: number
    a: number
    valorOriginalAtivo: number
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
 * @param m                Mês contratual vigente (base 1).
 * @param valorOriginalAtivo Valor do ativo no momento zero (base para o piso).
 * @param prazo            Prazo total do contrato em meses.
 * @returns Valor em R$.
 */
export function getResidualFloorValue(
  m: number,
  valorOriginalAtivo: number,
  prazo: number,
): number {
  const pct = getResidualFloorPct(m, prazo)
  return Math.max(0, valorOriginalAtivo) * pct
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
 * A(m) = valorOriginalAtivo × m / prazoContratualMeses
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
 * @param valorOriginalAtivo  Valor do ativo no momento zero (R$).
 * @param m                   Mês contratual (base 1).
 * @param prazoContratualMeses Prazo total do contrato em meses.
 * @returns Valor em R$.
 */
export function computeLinearTechnicalAmortization(
  valorOriginalAtivo: number,
  m: number,
  prazoContratualMeses: number,
): number {
  if (prazoContratualMeses <= 0 || m <= 0) return 0
  const mEfetivo = Math.min(m, prazoContratualMeses)
  return Math.max(0, valorOriginalAtivo) * (mEfetivo / prazoContratualMeses)
}

// ─── Cálculo Principal ───────────────────────────────────────────────────────

/**
 * Calcula o Valor de Exercício de Compra (VEC) conforme a fórmula contratual.
 *
 * Fórmula: VEC(m) = max(0, (VM × F(m)) – A(m))
 * Piso:    vecFinal = max(vecBase, pisoResidual(m, valorOriginalAtivo, prazo))
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
    valorMercadoUsina,
    valorOriginalAtivo,
    fatorDepreciacaoEconomica,
    amortizacaoTecnicaAcumulada,
  } = input

  const vm = Math.max(0, valorMercadoUsina)
  const f = Math.max(0, Math.min(1, fatorDepreciacaoEconomica))
  const a = Math.max(0, amortizacaoTecnicaAcumulada)
  const voa = Math.max(0, valorOriginalAtivo)

  // Fórmula base: VEC = max(0, VM × F(m) − A(m))
  const vecRaw = vm * f - a
  const vecBase = Math.max(0, vecRaw)

  // Piso residual mínimo contratual
  const pisoResidualAplicado = getResidualFloorValue(m, voa, prazoContratualMeses)

  // Valor final: nunca abaixo do piso
  const vecFinal = Math.max(vecBase, pisoResidualAplicado)

  return {
    vecBase,
    pisoResidualAplicado,
    vecFinal,
    memoriaCalculo: {
      vm,
      f,
      a,
      valorOriginalAtivo: voa,
      mesContratual: m,
      prazoContratualMeses,
    },
  }
}
