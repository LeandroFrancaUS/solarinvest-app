/**
 * audit-buyout-scenarios.ts
 *
 * Auditoria real do engine de buyout da SolarInvest.
 *
 * Usa EXCLUSIVAMENTE as funções canônicas do sistema:
 *   - calcularAnaliseFinanceira  → calcula preco_ideal_rs (VM base)
 *   - selectBuyoutLinhas         → computa VEC(m) por mês usando computeContractualBuyout
 *   - getResidualFloorPct        → retorna o piso residual contratual
 *
 * Premissas idênticas aos defaults do app (src/app/config.ts):
 *   - UF: GO | irradiacao: 5.0 | PR: 0.80 | diasMes: 30 | modulo: 550 Wp
 *   - tarifaCheia: R$ 1,14/kWh | desconto: 20% | inflacaoAa: 4%
 *   - depreciacaoAa: 12% a.a. | inadimplenciaAa: 2% | tributosAa: 6%
 *   - prazoContratual/duracaoMeses: 60 meses
 *   - kitFormula: 1500 + 9.5 × consumo | freteFormula: 300 + 0.52 × consumo
 *   - materialCA: max(1000, round(850 + 0.4 × consumo))
 *   - impostos venda: 8% | custo_fixo_rateado: 5% | lucro_minimo: 10%
 *   - margem_liquida_alvo: 25% | comissao_minima: 5%
 *
 * Meses auditados: 7, 13, 19, 25, 31, 37, 43, 49, 55, 60
 * Consumos: 30 valores distribuídos entre 600–3200 kWh/mês
 *
 * Para executar:
 *   npx tsx src/scripts/audit-buyout-scenarios.ts
 *
 * Saídas:
 *   - Tabela resumida (stdout)
 *   - Relatório Markdown em /tmp/audit-buyout-report.md
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  calcularAnaliseFinanceira,
  CREA_GO_RS,
  PRECO_PLACA_RS,
} from '../lib/finance/analiseFinanceiraSpreadsheet.js'
import {
  getResidualFloorPct,
} from '../lib/finance/buyout.js'
import { selectBuyoutLinhas } from '../selectors.js'
import type { SimulationState } from '../selectors.js'
import type { AnaliseFinanceiraInput } from '../types/analiseFinanceira.js'

// ─── Constantes canônicas do sistema ─────────────────────────────────────────

const UF = 'GO' as const
const IRRADIACAO = 5.0          // kWh/m²/dia
const PR = 0.80
const DIAS_MES = 30
const POTENCIA_MODULO_WP = 550
const TARIFA_CHEIA = 1.14       // R$/kWh
const DESCONTO = 0.20           // 20%
const INFLACAO_AA = 0.04        // 4% a.a.
const DEPRECIACAO_AA = 0.12     // 12% a.a.
const INADIMPLENCIA_AA = 0.02   // 2% a.a.
const TRIBUTOS_AA = 0.06        // 6% a.a.
const CASHBACK_PCT = 0.10       // 10%
const DURACAO_MESES = 60
const IMPOSTOS_VENDA_PCT = 8
const CUSTO_FIXO_PCT = 5
const LUCRO_MINIMO_PCT = 10
const MARGEM_ALVO_PCT = 25
const COMISSAO_MINIMA_PCT = 5

const MESES_AUDITADOS = [7, 13, 19, 25, 31, 37, 43, 49, 55, 60]

// ─── Geração determinística de 30 consumos distribuídos em 600–3200 ──────────

function gerarConsumos(): number[] {
  // Semente fixa para reprodutibilidade: linear congruential generator
  let seed = 42
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }
  const min = 600, max = 3200
  const set = new Set<number>()
  while (set.size < 30) {
    const v = min + Math.round(rand() * (max - min))
    set.add(v)
  }
  return Array.from(set).sort((a, b) => a - b)
}

// ─── Cálculo dos inputs de custo do kit por consumo ──────────────────────────

function buildAFInput(consumo: number): AnaliseFinanceiraInput {
  const custoKit = Math.round(1500 + 9.5 * consumo)
  const frete = Math.round(300 + 0.52 * consumo)
  const materialCA = Math.max(1000, Math.round(850 + 0.4 * consumo))

  // Calcular número de módulos para placa_rs e instalação
  const geracaoMensal = IRRADIACAO * PR * DIAS_MES   // kWh/kWp/mês
  const potNecessaria = consumo / geracaoMensal       // kWp
  const nModulos = Math.ceil((potNecessaria * 1000) / POTENCIA_MODULO_WP)
  const placaRs = nModulos * PRECO_PLACA_RS

  // Instalação: 70 R$/módulo (mesma fórmula do App.tsx)
  const instalacao = nModulos * 70

  // CREA GO
  const creaRs = CREA_GO_RS

  const investimentoInicial = custoKit + frete + instalacao + materialCA + creaRs + placaRs

  return {
    modo: 'venda',
    uf: UF,
    consumo_kwh_mes: consumo,
    irradiacao_kwh_m2_dia: IRRADIACAO,
    performance_ratio: PR,
    dias_mes: DIAS_MES,
    potencia_modulo_wp: POTENCIA_MODULO_WP,
    custo_kit_rs: custoKit,
    frete_rs: frete,
    descarregamento_rs: 0,
    instalacao_rs: instalacao,
    hotel_pousada_rs: 0,
    transporte_combustivel_rs: 0,
    outros_rs: 0,
    deslocamento_instaladores_rs: 0,
    placa_rs_override: placaRs,
    material_ca_rs_override: materialCA,
    crea_rs_override: creaRs,
    valor_contrato_rs: 0,
    impostos_percent: IMPOSTOS_VENDA_PCT,
    custo_fixo_rateado_percent: CUSTO_FIXO_PCT,
    lucro_minimo_percent: LUCRO_MINIMO_PCT,
    comissao_minima_percent: COMISSAO_MINIMA_PCT,
    margem_liquida_alvo_percent: MARGEM_ALVO_PCT,
    margem_liquida_minima_percent: 15,
    inadimplencia_percent: INADIMPLENCIA_AA * 100,
    custo_operacional_percent: 3,
    meses_projecao: DURACAO_MESES,
    mensalidades_previstas_rs: Array(DURACAO_MESES).fill(0) as number[],
    investimento_inicial_rs: investimentoInicial,
  }
}

// ─── Construção do SimulationState para selectBuyoutLinhas ───────────────────

function buildSimState(consumo: number, vm0: number): SimulationState {
  const geracaoMensal = IRRADIACAO * PR * DIAS_MES
  const potNecessaria = consumo / geracaoMensal
  const nModulos = Math.ceil((potNecessaria * 1000) / POTENCIA_MODULO_WP)
  const potSistema = (nModulos * POTENCIA_MODULO_WP) / 1000
  const geracaoKwh = potSistema * IRRADIACAO * PR * DIAS_MES

  return {
    kcKwhMes: consumo,
    consumoMensalKwh: consumo,
    tarifaCheia: TARIFA_CHEIA,
    desconto: DESCONTO,
    inflacaoAa: INFLACAO_AA,
    prazoMeses: DURACAO_MESES,
    taxaMinima: 0,
    encargosFixos: 0,
    entradaRs: 0,
    modoEntrada: 'NONE',
    vm0,
    depreciacaoAa: DEPRECIACAO_AA,
    ipcaAa: 0.04,
    inadimplenciaAa: INADIMPLENCIA_AA,
    tributosAa: TRIBUTOS_AA,
    custosFixosM: 0,
    opexM: 0,
    seguroM: 0,
    cashbackPct: CASHBACK_PCT,
    pagosAcumManual: 0,
    duracaoMeses: DURACAO_MESES,
    geracaoMensalKwh: geracaoKwh,
    mesReajuste: 6,
    mesReferencia: 1,
    tusdPercent: 27,
    tusdPercentualFioB: 27,
    tusdTipoCliente: 'residencial',
    tusdSubtipo: null,
    tusdSimultaneidade: null,
    tusdTarifaRkwh: null,
    tusdAnoReferencia: 2025,
    aplicaTaxaMinima: false,
    cidKwhBase: 0,
    tipoRede: 'nenhum',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const R = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number) => `${R(n * 100, 1)}%`

function faixaConsumo(c: number): string {
  if (c <= 1000) return '600–1000'
  if (c <= 1600) return '1001–1600'
  if (c <= 2200) return '1601–2200'
  if (c <= 2800) return '2201–2800'
  return '2801–3200'
}

function classificarFinanceiro(totalVsBase: number): string {
  if (totalVsBase >= 1.4) return 'Muito favorável'
  if (totalVsBase >= 1.2) return 'Favorável'
  if (totalVsBase >= 1.0) return 'Neutra'
  if (totalVsBase >= 0.85) return 'Fraca'
  return 'Desfavorável'
}

function avaliacaoMes(avgTotalPct: number, violacoes: number): string {
  if (violacoes > 0) return '🚫 Com violações'
  if (avgTotalPct >= 1.35) return '⭐ Excelente'
  if (avgTotalPct >= 1.20) return '✅ Muito bom'
  if (avgTotalPct >= 1.10) return '👍 Bom'
  if (avgTotalPct >= 1.00) return '🔵 Neutro'
  return '⚠️ Fraco'
}

// ─── Tipo de resultado por cenário ───────────────────────────────────────────

interface CenarioResult {
  consumo_kwh_mes: number
  faixa: string
  mes_buyout: number
  preco_ideal_inicial: number
  buyout_calculado: number
  buyout_pct_base: number
  piso_residual_pct: number
  piso_residual_rs: number
  respeitou_piso: boolean
  prestacoes_acumuladas: number
  total_recebido: number
  total_vs_base: number
  total_vs_base_pct: number
  resultado_bruto: number
  classificacao: string
  observacao: string
}

// ─── Execução principal ───────────────────────────────────────────────────────

function runAudit(): void {
  const consumos = gerarConsumos()
  const resultados: CenarioResult[] = []
  const erros: string[] = []

  for (const consumo of consumos) {
    // 1. Calcular preco_ideal via engine real
    const afInput = buildAFInput(consumo)
    let precoIdeal: number

    try {
      const afResult = calcularAnaliseFinanceira(afInput)
      if (afResult.preco_ideal_rs == null || !Number.isFinite(afResult.preco_ideal_rs)) {
        erros.push(`consumo=${consumo}: preco_ideal_rs não disponível`)
        continue
      }
      precoIdeal = afResult.preco_ideal_rs
    } catch (e) {
      erros.push(`consumo=${consumo}: AF falhou — ${String(e)}`)
      continue
    }

    // 2. Construir SimulationState com vm0 = preco_ideal
    const simState = buildSimState(consumo, precoIdeal)

    // 3. Calcular linhas de buyout via engine real
    const linhas = selectBuyoutLinhas(simState)

    // 4. Para cada mês de auditoria
    for (const mes of MESES_AUDITADOS) {
      const linha = linhas.find((l) => l.mes === mes)
      if (!linha) {
        erros.push(`consumo=${consumo}, mes=${mes}: linha não encontrada`)
        continue
      }

      const buyout = linha.valorResidual
      const prestacoes = linha.prestacaoAcum
      const total = prestacoes + buyout

      const pisoPct = getResidualFloorPct(mes, DURACAO_MESES)
      const pisoRs = precoIdeal * pisoPct
      // Tolerância de 1 centavo para arredondamento
      const respeitou = buyout >= pisoRs - 0.01

      const totalVsBase = precoIdeal > 0 ? total / precoIdeal : 0
      const buyoutPct = precoIdeal > 0 ? buyout / precoIdeal : 0

      let obs = ''
      if (!respeitou) {
        obs = `⚠️ VIOLAÇÃO DE PISO: buyout R$ ${fmt(buyout)} < piso R$ ${fmt(pisoRs)}`
      } else if (totalVsBase < 1.0) {
        obs = 'Total recebido abaixo do valor original'
      } else if (mes <= 13 && totalVsBase >= 1.3) {
        obs = 'Excelente antecipação de caixa'
      }

      resultados.push({
        consumo_kwh_mes: consumo,
        faixa: faixaConsumo(consumo),
        mes_buyout: mes,
        preco_ideal_inicial: R(precoIdeal),
        buyout_calculado: R(buyout),
        buyout_pct_base: R(buyoutPct, 4),
        piso_residual_pct: pisoPct,
        piso_residual_rs: R(pisoRs),
        respeitou_piso: respeitou,
        prestacoes_acumuladas: R(prestacoes),
        total_recebido: R(total),
        total_vs_base: R(totalVsBase, 4),
        total_vs_base_pct: R(totalVsBase * 100, 1),
        resultado_bruto: R(total - precoIdeal),
        classificacao: classificarFinanceiro(totalVsBase),
        observacao: obs,
      })
    }
  }

  // ─── Computar resumos ──────────────────────────────────────────────────────

  const violacoesPiso = resultados.filter((r) => !r.respeitou_piso)
  const totalCenarios = resultados.length
  const nConsumos = consumos.length

  const resumoPorMes = MESES_AUDITADOS.map((mes) => {
    const rows = resultados.filter((r) => r.mes_buyout === mes)
    if (rows.length === 0) return null
    const avgBuyoutPct = rows.reduce((s, r) => s + r.buyout_pct_base, 0) / rows.length
    const avgTotalPct = rows.reduce((s, r) => s + r.total_vs_base, 0) / rows.length
    const avgBuyoutRs = rows.reduce((s, r) => s + r.buyout_calculado, 0) / rows.length
    const avgTotalRs = rows.reduce((s, r) => s + r.total_recebido, 0) / rows.length
    const violacoes = rows.filter((r) => !r.respeitou_piso).length
    const lucrativo = rows.filter((r) => r.total_vs_base >= 1.0).length
    return {
      mes,
      avg_buyout_rs: R(avgBuyoutRs),
      avg_buyout_pct_base: pct(avgBuyoutPct),
      avg_total_rs: R(avgTotalRs),
      avg_total_pct_base: pct(avgTotalPct),
      avg_total_pct_raw: avgTotalPct,
      violacoes_piso: violacoes,
      cenarios_lucrativos: `${lucrativo}/${rows.length}`,
      avaliacao: avaliacaoMes(avgTotalPct, violacoes),
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const faixas = ['600–1000', '1001–1600', '1601–2200', '2201–2800', '2801–3200']
  const resumoPorFaixa = faixas.map((faixa) => {
    const rows = resultados.filter((r) => r.faixa === faixa)
    if (rows.length === 0) return null
    const avgTotalPct = rows.reduce((s, r) => s + r.total_vs_base, 0) / rows.length
    const violacoes = rows.filter((r) => !r.respeitou_piso).length
    const lucrativo = rows.filter((r) => r.total_vs_base >= 1.0).length
    return {
      faixa,
      cenarios: rows.length,
      avg_total_pct_base: pct(avgTotalPct),
      violacoes_piso: violacoes,
      cenarios_lucrativos: `${lucrativo}/${rows.length}`,
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const pisoRespeitado = violacoesPiso.length === 0
  const todosMesesLucrativos = resumoPorMes.every((r) => {
    const rows = resultados.filter((x) => x.mes_buyout === r.mes)
    return rows.every((x) => x.total_vs_base >= 1.0)
  })
  const mesSeteLucrativo = resultados
    .filter((r) => r.mes_buyout === 7)
    .every((r) => r.total_vs_base >= 1.0)

  const melhorMes = resumoPorMes.reduce((best, cur) =>
    cur.avg_total_pct_raw > best.avg_total_pct_raw ? cur : best
  )
  const piorMes = resumoPorMes.reduce((worst, cur) =>
    cur.avg_total_pct_raw < worst.avg_total_pct_raw ? cur : worst
  )

  // ─── Relatório Markdown ────────────────────────────────────────────────────

  const lines: string[] = []
  lines.push('# Auditoria de Buyout — SolarInvest Engine')
  lines.push('')
  lines.push('> Gerado em: ' + new Date().toLocaleString('pt-BR'))
  lines.push('')
  lines.push('## Parâmetros da Auditoria')
  lines.push('')
  lines.push('| Parâmetro | Valor |')
  lines.push('|-----------|-------|')
  lines.push(`| Engine | calcularAnaliseFinanceira + computeContractualBuyout + selectBuyoutLinhas |`)
  lines.push(`| UF | ${UF} |`)
  lines.push(`| Irradiação | ${IRRADIACAO} kWh/m²/dia |`)
  lines.push(`| Performance Ratio | ${PR} |`)
  lines.push(`| Dias/mês | ${DIAS_MES} |`)
  lines.push(`| Módulo | ${POTENCIA_MODULO_WP} Wp |`)
  lines.push(`| Tarifa cheia | R$ ${TARIFA_CHEIA}/kWh |`)
  lines.push(`| Desconto contratual | ${DESCONTO * 100}% |`)
  lines.push(`| Inflação a.a. | ${INFLACAO_AA * 100}% |`)
  lines.push(`| Depreciação a.a. | ${DEPRECIACAO_AA * 100}% |`)
  lines.push(`| Inadimplência a.a. | ${INADIMPLENCIA_AA * 100}% |`)
  lines.push(`| Tributos a.a. | ${TRIBUTOS_AA * 100}% |`)
  lines.push(`| Duração contrato | ${DURACAO_MESES} meses |`)
  lines.push(`| Impostos venda | ${IMPOSTOS_VENDA_PCT}% |`)
  lines.push(`| Custo fixo rateado | ${CUSTO_FIXO_PCT}% |`)
  lines.push(`| Margem líquida alvo | ${MARGEM_ALVO_PCT}% |`)
  lines.push(`| Comissão mínima | ${COMISSAO_MINIMA_PCT}% |`)
  lines.push(`| Kit (fórmula) | 1500 + 9.5 × consumo |`)
  lines.push(`| Frete (fórmula) | 300 + 0.52 × consumo |`)
  lines.push(`| Material CA | max(1000, round(850 + 0.40 × consumo)) |`)
  lines.push(`| Instalação | 70 R$/módulo |`)
  lines.push(`| Placa | R$ ${PRECO_PLACA_RS}/módulo |`)
  lines.push(`| CREA | R$ ${CREA_GO_RS} (GO) |`)
  lines.push('')
  lines.push('## Consumos Simulados')
  lines.push('')
  lines.push(consumos.join(', ') + ' kWh/mês')
  lines.push('')
  lines.push(`**Total de cenários:** ${totalCenarios} (${nConsumos} consumos × ${MESES_AUDITADOS.length} meses)`)
  lines.push('')

  lines.push('## Tabela Detalhada')
  lines.push('')
  lines.push('| Consumo | Mês | Preço Ideal | Buyout | Buyout% | Piso% | Piso R$ | ✓Piso | Prestações | Total | Total% | Resultado | Classificação | Obs |')
  lines.push('|---------|-----|-------------|--------|---------|-------|---------|-------|-----------|-------|--------|-----------|---------------|-----|')
  for (const r of resultados) {
    const pisoIcon = r.respeitou_piso ? '✅' : '🚫'
    lines.push(
      `| ${r.consumo_kwh_mes} | ${r.mes_buyout} | ${fmt(r.preco_ideal_inicial)} | ${fmt(r.buyout_calculado)} | ${pct(r.buyout_pct_base)} | ${pct(r.piso_residual_pct)} | ${fmt(r.piso_residual_rs)} | ${pisoIcon} | ${fmt(r.prestacoes_acumuladas)} | ${fmt(r.total_recebido)} | ${r.total_vs_base_pct}% | ${fmt(r.resultado_bruto)} | ${r.classificacao} | ${r.observacao} |`
    )
  }
  lines.push('')

  lines.push('## Resumo por Mês de Buyout')
  lines.push('')
  lines.push('| Mês | Buyout Médio | Buyout% | Total Médio | Total% | Violações Piso | Lucrativos | Avaliação |')
  lines.push('|-----|-------------|---------|-------------|--------|----------------|------------|-----------|')
  for (const r of resumoPorMes) {
    lines.push(
      `| ${r.mes} | R$ ${fmt(r.avg_buyout_rs)} | ${r.avg_buyout_pct_base} | R$ ${fmt(r.avg_total_rs)} | ${r.avg_total_pct_base} | ${r.violacoes_piso} | ${r.cenarios_lucrativos} | ${r.avaliacao} |`
    )
  }
  lines.push('')

  lines.push('## Resumo por Faixa de Consumo')
  lines.push('')
  lines.push('| Faixa kWh/mês | Cenários | Total% Médio | Violações Piso | Lucrativos |')
  lines.push('|---------------|----------|--------------|----------------|------------|')
  for (const r of resumoPorFaixa) {
    lines.push(
      `| ${r.faixa} | ${r.cenarios} | ${r.avg_total_pct_base} | ${r.violacoes_piso} | ${r.cenarios_lucrativos} |`
    )
  }
  lines.push('')

  lines.push('## Verificação do Piso Residual Mínimo')
  lines.push('')
  if (pisoRespeitado) {
    lines.push('✅ **Nenhuma violação detectada.** O engine respeita o piso residual mínimo em todos os ' + totalCenarios + ' cenários.')
  } else {
    lines.push(`🚫 **${violacoesPiso.length} violação(ões) detectada(s) em ${totalCenarios} cenários:**`)
    lines.push('')
    lines.push('| Consumo | Mês | Buyout | Piso Esperado | Diferença |')
    lines.push('|---------|-----|--------|---------------|-----------|')
    for (const v of violacoesPiso) {
      lines.push(`| ${v.consumo_kwh_mes} | ${v.mes_buyout} | R$ ${fmt(v.buyout_calculado)} | R$ ${fmt(v.piso_residual_rs)} | R$ ${fmt(v.buyout_calculado - v.piso_residual_rs)} |`)
    }
  }
  lines.push('')

  if (erros.length > 0) {
    lines.push('## Erros de Cálculo')
    lines.push('')
    for (const e of erros) lines.push(`- ${e}`)
    lines.push('')
  }

  lines.push('## Conclusões Executivas')
  lines.push('')
  lines.push('### 1. O sistema respeita o piso residual mínimo?')
  lines.push(`**${pisoRespeitado ? '✅ SIM' : '🚫 NÃO'}** — ${violacoesPiso.length} violação(ões) em ${totalCenarios} cenários.`)
  lines.push('')

  lines.push('### 2. O buyout a partir do 6º mês completo (mês 7) é lucrativo?')
  lines.push(`**${mesSeteLucrativo ? '✅ SIM' : '⚠️ PARCIAL'}** — ${todosMesesLucrativos ? 'Todos os meses auditados geram total > valor original.' : 'Alguns meses podem apresentar resultado neutro.'}`)
  lines.push('')

  lines.push('### 3. Melhores meses para venda antecipada')
  lines.push(`**Melhor mês:** Mês **${melhorMes.mes}** — total médio ${melhorMes.avg_total_pct_base} do valor original.`)
  lines.push(`Combina buyout ainda relevante + maior volume acumulado de prestações.`)
  lines.push('')

  lines.push('### 4. Janela mais fraca')
  lines.push(`**Mês mais fraco:** Mês **${piorMes.mes}** — total médio ${piorMes.avg_total_pct_base} do valor original.`)
  lines.push(`(Mesmo assim pode ser lucrativo — é apenas o menor retorno relativo do período auditado.)`)
  lines.push('')

  lines.push('### 5. O ganho de caixa antecipado compensa a perda de receitas futuras?')
  const mesSet = resumoPorMes.find((r) => r.mes === 7)
  if (mesSet) {
    lines.push(`No mês 7, total médio = ${mesSet.avg_total_pct_base} do valor original.`)
    lines.push(`A antecipação reduz exposição à inadimplência (${INADIMPLENCIA_AA * 100}% a.a.) e à depreciação futura do ativo (${DEPRECIACAO_AA * 100}% a.a.), tornando o buyout financeiramente positivo mesmo nos meses iniciais.`)
  }
  lines.push('')

  lines.push('### 6. Padrão por faixa de consumo')
  for (const f of resumoPorFaixa) {
    lines.push(`- **${f.faixa} kWh/mês:** total médio ${f.avg_total_pct_base} — ${f.cenarios_lucrativos} lucrativos — ${f.violacoes_piso} violações`)
  }
  lines.push('')

  lines.push('### 7. Há indício de cálculo incorreto ou economicamente perigoso?')
  if (!pisoRespeitado) {
    lines.push('🚫 **Violações de piso detectadas** — ver tabela de violações acima. Revisão urgente necessária.')
  } else if (todosMesesLucrativos) {
    lines.push('✅ **Nenhuma anomalia.** Todos os cenários são lucrativos e o piso é respeitado.')
  } else {
    lines.push('⚠️ Alguns cenários apresentam resultado neutro. Revisar meses com total < 100% do valor original.')
  }
  lines.push('')

  lines.push('---')
  lines.push(`*Auditoria com ${totalCenarios} cenários reais. Engine: computeContractualBuyout + calcularAnaliseFinanceira + selectBuyoutLinhas.*`)

  // ─── Escrever relatório ────────────────────────────────────────────────────

  const reportPath = path.join('/tmp', 'audit-buyout-report.md')
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')

  // ─── Stdout ───────────────────────────────────────────────────────────────

  console.log('\n=== RESUMO POR MÊS ===')
  console.table(
    resumoPorMes.map((r) => ({
      'Mês': r.mes,
      'Buyout Médio': `R$ ${fmt(r.avg_buyout_rs)}`,
      'Buyout%': r.avg_buyout_pct_base,
      'Total Médio': `R$ ${fmt(r.avg_total_rs)}`,
      'Total%': r.avg_total_pct_base,
      'Violações Piso': r.violacoes_piso,
      'Lucrativos': r.cenarios_lucrativos,
      'Avaliação': r.avaliacao,
    }))
  )

  console.log('\n=== RESUMO POR FAIXA DE CONSUMO ===')
  console.table(
    resumoPorFaixa.map((r) => ({
      'Faixa': r.faixa,
      'Cenários': r.cenarios,
      'Total%': r.avg_total_pct_base,
      'Violações Piso': r.violacoes_piso,
      'Lucrativos': r.cenarios_lucrativos,
    }))
  )

  console.log(`\n=== VIOLAÇÕES DE PISO: ${violacoesPiso.length} ===`)
  if (violacoesPiso.length === 0) {
    console.log('✅ Nenhuma violação. Piso residual mínimo respeitado em todos os cenários.')
  } else {
    console.table(violacoesPiso.map((v) => ({
      consumo: v.consumo_kwh_mes,
      mes: v.mes_buyout,
      buyout: `R$ ${fmt(v.buyout_calculado)}`,
      piso: `R$ ${fmt(v.piso_residual_rs)}`,
      diferença: `R$ ${fmt(v.buyout_calculado - v.piso_residual_rs)}`,
    })))
  }

  console.log('\n=== CONCLUSÕES EXECUTIVAS ===')
  console.log(`Piso residual respeitado:                ${pisoRespeitado ? 'SIM ✅' : 'NÃO 🚫'}`)
  console.log(`Mês 7 lucrativo (todos os cenários):    ${mesSeteLucrativo ? 'SIM ✅' : 'NÃO ⚠️'}`)
  console.log(`Todos os meses lucrativos:              ${todosMesesLucrativos ? 'SIM ✅' : 'PARCIAL ⚠️'}`)
  console.log(`Melhor janela de venda:                 Mês ${melhorMes.mes} (${melhorMes.avg_total_pct_base} total médio)`)
  console.log(`Janela mais fraca:                      Mês ${piorMes.mes} (${piorMes.avg_total_pct_base} total médio)`)
  console.log(`Total de cenários analisados:           ${totalCenarios}`)
  console.log(`Consumos simulados:                     ${nConsumos}`)
  console.log(`\n✅ Relatório completo em: ${reportPath}`)

  if (erros.length > 0) {
    console.log(`\n⚠️ ${erros.length} erro(s) de cálculo:`)
    for (const e of erros) console.log(`  - ${e}`)
  }
}

runAudit()
