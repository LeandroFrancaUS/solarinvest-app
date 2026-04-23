/**
 * Regras centrais de tributação para análise financeira.
 *
 * Venda  — base tributável exclui custo do kit e frete.
 * Leasing — base tributável é somente a mensalidade.
 *
 * Todas as áreas do sistema devem usar `computeTaxes` para calcular impostos —
 * nunca recalcular inline na UI ou em funções auxiliares.
 */

export const DEFAULT_ALIQUOTA_VENDA = 0.06 // 6%
export const DEFAULT_ALIQUOTA_LEASING = 0.04 // 4%

export type TaxModo = 'venda' | 'leasing'

export interface ComputeTaxesVendaInput {
  modo: 'venda'
  /** Valor total antes do imposto (ex.: valor_contrato_rs). */
  totalAntesImposto: number
  /** Custo do kit de equipamentos — excluído da base tributável. */
  custoKit?: number | null
  /** Valor do frete — excluído da base tributável. */
  frete?: number | null
  /**
   * Alíquota em decimal (ex.: 0.06 = 6%).
   * Quando omitida ou inválida, aplica DEFAULT_ALIQUOTA_VENDA (6%).
   */
  aliquota?: number | null
}

export interface ComputeTaxesLeasingInput {
  modo: 'leasing'
  /** Mensalidade contratual bruta. Única base tributável no leasing. */
  mensalidade: number
  /**
   * Alíquota em decimal (ex.: 0.04 = 4%).
   * Quando omitida ou inválida, aplica DEFAULT_ALIQUOTA_LEASING (4%).
   */
  aliquota?: number | null
}

export type ComputeTaxesInput = ComputeTaxesVendaInput | ComputeTaxesLeasingInput

export interface ComputeTaxesOutput {
  /** Base sobre a qual o imposto incide. */
  baseTributavel: number
  /** Alíquota efetivamente aplicada (decimal). */
  aliquotaAplicada: number
  /** Valor absoluto do imposto calculado (R$). */
  valorImposto: number
}

/** Normaliza null/undefined/NaN para 0. */
const nz = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0

/**
 * Calcula impostos de acordo com a modalidade da proposta.
 *
 * Regra Venda:
 *   baseTributavel = max(0, totalAntesImposto - custoKit - frete)
 *   valorImposto   = baseTributavel × aliquota
 *   default aliquota = 6%
 *
 * Regra Leasing:
 *   baseTributavel = mensalidade
 *   valorImposto   = mensalidade × aliquota
 *   default aliquota = 4%
 */
export function computeTaxes(input: ComputeTaxesInput): ComputeTaxesOutput {
  if (input.modo === 'venda') {
    const aliquotaAplicada =
      input.aliquota != null && Number.isFinite(input.aliquota) && input.aliquota >= 0
        ? input.aliquota
        : DEFAULT_ALIQUOTA_VENDA

    const totalAntesImposto = nz(input.totalAntesImposto)
    const custoKit = nz(input.custoKit)
    const frete = nz(input.frete)

    const baseTributavel = Math.max(0, totalAntesImposto - custoKit - frete)
    const valorImposto = baseTributavel * aliquotaAplicada

    return { baseTributavel, aliquotaAplicada, valorImposto }
  }

  // leasing
  const aliquotaAplicada =
    input.aliquota != null && Number.isFinite(input.aliquota) && input.aliquota >= 0
      ? input.aliquota
      : DEFAULT_ALIQUOTA_LEASING

  const baseTributavel = Math.max(0, nz(input.mensalidade))
  const valorImposto = baseTributavel * aliquotaAplicada

  return { baseTributavel, aliquotaAplicada, valorImposto }
}
