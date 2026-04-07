/**
 * Engine centralizada de cálculos interdependentes do sistema fotovoltaico.
 *
 * Ordem de prioridade (conforme regras de negócio):
 * 1. potenciaModuloWp + numeroModulos → potenciaSistemaKwp
 * 2. potenciaSistemaKwp → geracaoKwhMes (via estimateMonthlyGenerationKWh)
 * 3. geracaoKwhMes (manual) → potenciaSistemaKwp (inverso da geração)
 * 4. consumoKwhMes segue geracaoKwhMes por padrão
 * 5. consumoKwhMes (manual override) → geracaoKwhMes = consumoKwhMes
 *
 * Cada página (Leasing e Vendas) usa somente seus próprios dados — sem
 * compartilhamento cruzado de valores.
 */

import { estimateMonthlyGenerationKWh, reverseGenerationToKwp, DEFAULT_PERFORMANCE_RATIO, DEFAULT_DIAS_MES } from './generation'
import { IRRADIACAO_FALLBACK } from '../../utils/irradiacao'

export type SistemaInput = {
  /** Potência nominal de cada módulo em Wp */
  potenciaModuloWp?: number | null
  /** Quantidade de módulos instalados */
  numeroModulos?: number | null
  /** Potência total do sistema em kWp */
  potenciaSistemaKwp?: number | null
  /** Geração mensal estimada em kWh/mês */
  geracaoKwhMes?: number | null
  /** Consumo mensal em kWh/mês */
  consumoKwhMes?: number | null
  /** Irradiação solar local em kWh/m²/dia (HSP) */
  irradiacao?: number | null
  /** Performance ratio (0-1) */
  performanceRatio?: number | null
  /** Dias por mês considerados no cálculo */
  diasMes?: number | null
}

export type SistemaResolvido = {
  potenciaModuloWp: number | null
  numeroModulos: number | null
  potenciaSistemaKwp: number | null
  geracaoKwhMes: number | null
  consumoKwhMes: number | null
}

function toPositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

function toPositiveInt(value: number | null | undefined): number | null {
  const v = toPositive(value)
  if (v == null) return null
  const r = Math.round(v)
  return r > 0 ? r : null
}

/**
 * Resolve todas as variáveis interdependentes do sistema fotovoltaico.
 *
 * A função é pura e determinística: os mesmos inputs sempre produzem os
 * mesmos outputs. Não dispara setState — deve ser chamada de dentro de
 * useEffect/useMemo para atualizar o estado do formulário.
 *
 * Proteção contra loop: só atualiza o estado quando o valor calculado
 * for diferente do valor atual (verificar antes de chamar setState).
 */
export function resolveSistema(input: SistemaInput): SistemaResolvido {
  let potenciaModuloWp = toPositive(input.potenciaModuloWp)
  let numeroModulos = toPositiveInt(input.numeroModulos)
  let potenciaSistemaKwp = toPositive(input.potenciaSistemaKwp)
  let geracaoKwhMes = toPositive(input.geracaoKwhMes)
  let consumoKwhMes = toPositive(input.consumoKwhMes)

  const hsp = toPositive(input.irradiacao) ?? IRRADIACAO_FALLBACK
  const pr = toPositive(input.performanceRatio) ?? DEFAULT_PERFORMANCE_RATIO
  const dias = toPositive(input.diasMes) ?? DEFAULT_DIAS_MES

  // 1. Base estrutural: módulo × quantidade → potência do sistema
  if (potenciaModuloWp && numeroModulos) {
    potenciaSistemaKwp = (potenciaModuloWp * numeroModulos) / 1000
  }

  // Reverso: potência + potenciaModulo → quantidade
  if (potenciaSistemaKwp && potenciaModuloWp && !numeroModulos) {
    numeroModulos = Math.round((potenciaSistemaKwp * 1000) / potenciaModuloWp)
  }

  // Reverso: potência + quantidade → potenciaModulo
  if (potenciaSistemaKwp && numeroModulos && !potenciaModuloWp) {
    potenciaModuloWp = (potenciaSistemaKwp * 1000) / numeroModulos
  }

  // 2. Geração a partir da potência instalada
  if (potenciaSistemaKwp) {
    const calculada = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: potenciaSistemaKwp,
      irradiacao_kwh_m2_dia: hsp,
      performance_ratio: pr,
      dias_mes: dias,
    })
    if (calculada > 0) {
      geracaoKwhMes = calculada
    }
  }

  // 3. Override manual de geração → calcula potência do sistema (inverso)
  if (!potenciaSistemaKwp && geracaoKwhMes) {
    const kwp = reverseGenerationToKwp(geracaoKwhMes, { hsp, pr, dias_mes: dias })
    if (kwp) {
      potenciaSistemaKwp = kwp
    }
  }

  // 4. Consumo segue geração (padrão)
  if (geracaoKwhMes && !consumoKwhMes) {
    consumoKwhMes = geracaoKwhMes
  }

  // 5. Override manual de consumo
  if (consumoKwhMes && !geracaoKwhMes) {
    geracaoKwhMes = consumoKwhMes
  }

  return {
    potenciaModuloWp: potenciaModuloWp ?? null,
    numeroModulos: numeroModulos ?? null,
    potenciaSistemaKwp: potenciaSistemaKwp ?? null,
    geracaoKwhMes: geracaoKwhMes ?? null,
    consumoKwhMes: consumoKwhMes ?? null,
  }
}
