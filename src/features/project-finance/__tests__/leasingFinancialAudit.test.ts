// src/features/project-finance/__tests__/leasingFinancialAudit.test.ts
//
// Auditoria completa da página Financeiro → Leasing (Gestão Financeira).
//
// Para cada cenário de leasing simulado, recalculamos os KPIs de forma
// independente (cash-flow mês-a-mês com reajuste anual, fator líquido,
// manutenção como despesa total distribuída, VPL via descontagem mensal) e
// comparamos com o resultado do motor `computeProjectKPIs`.
//
// Cenários cobrem:
//   - Reajuste anual = 0 % e > 0 %
//   - Inadimplência = 0 % e alta
//   - OPEX (custo operacional) = 0 % e alto
//   - Manutenção = 0 e positiva
//   - Prazos curtos (12, 24 meses) e longos (60, 84, 120 meses)
//   - Receita > custo, receita ≈ custo, receita < custo
//   - VPL positivo, VPL negativo
//   - TIR inexistente (sem retorno suficiente)
//   - Variação de mensalidade, descontos e taxa de desconto
//
// Total: 50 cenários parametrizados.

import { describe, it, expect } from 'vitest'
import {
  computeProjectKPIs,
  computeProjectFinancialState,
  computeReceitaTotalBruta,
} from '../calculations'
import type { ProjectFinanceFormState } from '../types'
import {
  computeIRR,
  computeNPV,
  computePayback,
  toMonthlyRate,
} from '../../../lib/finance/investmentMetrics'

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface LeasingScenario {
  label: string
  capex: number              // Custo total do projeto (R$) — entra como custo_equipamentos
  mensalidade: number        // Mensalidade base (R$/mês)
  desconto_pct: number       // Desconto ao cliente (%)
  prazo: number              // Prazo do contrato (meses)
  reajuste_anual_pct: number // Reajuste anual (%)
  inadimplencia_pct: number  // Taxa de inadimplência (%)
  opex_pct: number           // Custo operacional (%)
  custo_seguro: number       // Seguro (R$, CAPEX)
  custo_manutencao: number   // Manutenção (R$, despesa total contrato)
  impostos_pct: number       // Imposto leasing sobre mensalidade (%)
  taxa_desconto_aa_pct: number | null // Taxa de desconto anual (% a.a.) — null = sem VPL
  vrg?: number               // Valor Residual Garantido no fim do contrato (R$, opcional)
}

// ─── Cálculo de referência (independente do motor) ────────────────────────────

interface Reference {
  receitaBrutaTotal: number
  receitaLiquidaTotal: number
  fluxoMensal: number[]            // sem t0
  payback: number | null
  roi: number
  tirAnualPct: number | null
  vpl: number | null
}

/**
 * Mensalidade efetiva após o desconto ao cliente.
 * Convenção: o cenário declara `mensalidade` "cheia" (pré-desconto). O
 * desconto é aplicado uma única vez aqui — usado tanto na referência quanto
 * em `buildForm` para garantir consistência.
 */
function mensalidadeComDesconto(s: LeasingScenario): number {
  return s.mensalidade * (1 - s.desconto_pct / 100)
}

function expectedReference(s: LeasingScenario): Reference {
  // Mensalidade efetiva = mensalidade × (1 − desconto/100)
  const mensalidadeBase = mensalidadeComDesconto(s)

  // Fator líquido = 1 − impostos − inadimplência − opex (todos sobre mensalidade)
  const fatorLiquido = Math.max(
    0,
    1 - s.impostos_pct / 100 - s.inadimplencia_pct / 100 - s.opex_pct / 100,
  )

  // Manutenção total distribuída em cada mês.
  const manutencaoMensal = s.custo_manutencao / s.prazo

  // Reajuste por ano: mensalidade_t = base × (1+r)^⌊t/12⌋
  const reajuste = s.reajuste_anual_pct / 100

  let receitaBrutaTotal = 0
  let receitaLiquidaTotal = 0
  const fluxoMensal: number[] = []
  for (let t = 0; t < s.prazo; t++) {
    const mensalidadeBruta = mensalidadeBase * Math.pow(1 + reajuste, Math.floor(t / 12))
    const liquida = mensalidadeBruta * fatorLiquido - manutencaoMensal
    fluxoMensal.push(liquida)
    receitaBrutaTotal += mensalidadeBruta
    receitaLiquidaTotal += liquida
  }

  // CAPEX = custo total do projeto: entra `capex` (custo_equipamentos no form)
  // e `custo_seguro` é somado como CAPEX adicional pelo motor (computeCustoTotal).
  const capex = s.capex + s.custo_seguro

  const lucro = receitaLiquidaTotal - capex
  const roi = (lucro / capex) * 100

  // Para payback / TIR / VPL precisamos da série completa com t0 = −capex
  const fluxoCompleto = [-capex, ...fluxoMensal]

  // Se houver VRG, soma no último mês
  if (s.vrg && s.vrg > 0) {
    fluxoCompleto[fluxoCompleto.length - 1] =
      (fluxoCompleto[fluxoCompleto.length - 1] ?? 0) + s.vrg
  }

  const payback = computePayback(fluxoCompleto)
  const tirMensal = computeIRR(fluxoCompleto)
  const tirAnualPct = tirMensal !== null ? (Math.pow(1 + tirMensal, 12) - 1) * 100 : null

  const vpl =
    s.taxa_desconto_aa_pct != null && s.taxa_desconto_aa_pct > 0
      ? computeNPV(fluxoCompleto, toMonthlyRate(s.taxa_desconto_aa_pct))
      : null

  return {
    receitaBrutaTotal,
    receitaLiquidaTotal,
    fluxoMensal,
    payback,
    roi,
    tirAnualPct,
    vpl,
  }
}

// ─── Conversão Cenário → Form do motor ────────────────────────────────────────

function buildForm(s: LeasingScenario): ProjectFinanceFormState {
  // Mensalidade efetiva = mensalidade × (1 − desconto/100), aplicada via
  // `mensalidadeComDesconto` para manter consistência com `expectedReference`.
  const mensalidade = mensalidadeComDesconto(s)
  return {
    custo_equipamentos: s.capex,
    custo_seguro: s.custo_seguro,
    mensalidade_base: mensalidade,
    desconto_percentual: s.desconto_pct,
    reajuste_anual_pct: s.reajuste_anual_pct,
    inadimplencia_pct: s.inadimplencia_pct,
    opex_pct: s.opex_pct,
    custo_manutencao: s.custo_manutencao,
  }
}

// ─── 50 cenários ──────────────────────────────────────────────────────────────

function makeScenarios(): LeasingScenario[] {
  const list: LeasingScenario[] = []

  // ── 1-10: variação principal de prazo e reajuste ─────────────────────────────
  list.push({ label: '01 prazo curto 12m, sem reajuste, sem inad/opex', capex: 12000, mensalidade: 800, desconto_pct: 0, prazo: 12, reajuste_anual_pct: 0, inadimplencia_pct: 0, opex_pct: 0, custo_seguro: 200, custo_manutencao: 0, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '02 prazo 24m, reajuste 0%', capex: 18000, mensalidade: 950, desconto_pct: 0, prazo: 24, reajuste_anual_pct: 0, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 500, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '03 prazo 36m, reajuste 4%', capex: 22000, mensalidade: 1100, desconto_pct: 5, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 300, custo_manutencao: 800, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '04 prazo 48m, reajuste 5%', capex: 25000, mensalidade: 1250, desconto_pct: 5, prazo: 48, reajuste_anual_pct: 5, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 320, custo_manutencao: 1200, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '05 prazo 60m, reajuste 4%', capex: 28000, mensalidade: 1300, desconto_pct: 0, prazo: 60, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 350, custo_manutencao: 1500, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '06 prazo 72m, reajuste 4%', capex: 30000, mensalidade: 1400, desconto_pct: 5, prazo: 72, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 400, custo_manutencao: 1800, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '07 prazo 84m, reajuste 4%', capex: 32000, mensalidade: 1500, desconto_pct: 0, prazo: 84, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 420, custo_manutencao: 2100, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '08 prazo 96m, reajuste 5%', capex: 36000, mensalidade: 1700, desconto_pct: 5, prazo: 96, reajuste_anual_pct: 5, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 480, custo_manutencao: 2400, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '09 prazo 120m, reajuste 6%', capex: 40000, mensalidade: 1850, desconto_pct: 5, prazo: 120, reajuste_anual_pct: 6, inadimplencia_pct: 3, opex_pct: 3, custo_seguro: 520, custo_manutencao: 3000, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '10 prazo 60m, reajuste 0% (controle)', capex: 25000, mensalidade: 1100, desconto_pct: 0, prazo: 60, reajuste_anual_pct: 0, inadimplencia_pct: 0, opex_pct: 0, custo_seguro: 250, custo_manutencao: 0, impostos_pct: 4, taxa_desconto_aa_pct: 10 })

  // ── 11-20: extremos de inadimplência ─────────────────────────────────────────
  list.push({ label: '11 inadimplência = 0%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 0, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '12 inadimplência = 1%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 1, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '13 inadimplência = 5%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 5, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '14 inadimplência = 10%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 10, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '15 inadimplência alta 20%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 20, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '16 opex = 0%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 0, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '17 opex = 5%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 5, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '18 opex alto 15%', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 15, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '19 manutenção = 0', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 60, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 0, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '20 manutenção alta 5000', capex: 20000, mensalidade: 1000, desconto_pct: 0, prazo: 60, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 5000, impostos_pct: 4, taxa_desconto_aa_pct: 10 })

  // ── 21-30: receita vs custo ─────────────────────────────────────────────────
  list.push({ label: '21 receita > custo (margem grande)', capex: 15000, mensalidade: 1500, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 200, custo_manutencao: 500, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '22 receita ≈ custo (break-even)', capex: 30000, mensalidade: 900, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 0, inadimplencia_pct: 5, opex_pct: 5, custo_seguro: 200, custo_manutencao: 800, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '23 receita < custo (prejuízo)', capex: 60000, mensalidade: 800, desconto_pct: 5, prazo: 24, reajuste_anual_pct: 0, inadimplencia_pct: 5, opex_pct: 5, custo_seguro: 300, custo_manutencao: 1000, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '24 lucro forte com prazo longo', capex: 25000, mensalidade: 1400, desconto_pct: 5, prazo: 96, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 350, custo_manutencao: 2000, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '25 lucro borderline com taxa alta', capex: 20000, mensalidade: 1000, desconto_pct: 5, prazo: 36, reajuste_anual_pct: 3, inadimplencia_pct: 4, opex_pct: 4, custo_seguro: 250, custo_manutencao: 800, impostos_pct: 6, taxa_desconto_aa_pct: 18 })
  list.push({ label: '26 desconto agressivo 20%', capex: 20000, mensalidade: 1200, desconto_pct: 20, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '27 desconto 0% (preço cheio)', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '28 mensalidade alta R$ 5000', capex: 80000, mensalidade: 5000, desconto_pct: 5, prazo: 60, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 800, custo_manutencao: 5000, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '29 mensalidade baixa R$ 350', capex: 5000, mensalidade: 350, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 100, custo_manutencao: 200, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '30 sem seguro', capex: 18000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 0, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })

  // ── 31-40: variação de taxa de desconto / VPL ────────────────────────────────
  list.push({ label: '31 sem taxa de desconto (VPL = null)', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: null })
  list.push({ label: '32 taxa baixa 5%', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 5 })
  list.push({ label: '33 taxa moderada 10%', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '34 taxa alta 18%', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 18 })
  list.push({ label: '35 taxa muito alta 30% (VPL → negativo)', capex: 20000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 250, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 30 })
  list.push({ label: '36 capex alto, VPL negativo esperado', capex: 60000, mensalidade: 1000, desconto_pct: 0, prazo: 60, reajuste_anual_pct: 0, inadimplencia_pct: 5, opex_pct: 5, custo_seguro: 600, custo_manutencao: 2000, impostos_pct: 6, taxa_desconto_aa_pct: 18 })
  list.push({ label: '37 capex muito alto, TIR provavelmente null', capex: 100000, mensalidade: 800, desconto_pct: 0, prazo: 24, reajuste_anual_pct: 0, inadimplencia_pct: 10, opex_pct: 10, custo_seguro: 500, custo_manutencao: 1000, impostos_pct: 6, taxa_desconto_aa_pct: 12 })
  list.push({ label: '38 receita totalmente consumida (TIR null)', capex: 30000, mensalidade: 600, desconto_pct: 0, prazo: 12, reajuste_anual_pct: 0, inadimplencia_pct: 30, opex_pct: 30, custo_seguro: 300, custo_manutencao: 5000, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '39 alta inadimplência + alta opex', capex: 20000, mensalidade: 1200, desconto_pct: 5, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 8, opex_pct: 8, custo_seguro: 250, custo_manutencao: 800, impostos_pct: 4, taxa_desconto_aa_pct: 12 })
  list.push({ label: '40 reajuste alto 8%', capex: 22000, mensalidade: 1200, desconto_pct: 5, prazo: 60, reajuste_anual_pct: 8, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 280, custo_manutencao: 1200, impostos_pct: 4, taxa_desconto_aa_pct: 10 })

  // ── 41-50: combinações finais e variações de impostos ────────────────────────
  list.push({ label: '41 impostos altos 8%', capex: 22000, mensalidade: 1200, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 280, custo_manutencao: 600, impostos_pct: 8, taxa_desconto_aa_pct: 10 })
  list.push({ label: '42 impostos = 0%', capex: 22000, mensalidade: 1200, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 280, custo_manutencao: 600, impostos_pct: 0, taxa_desconto_aa_pct: 10 })
  list.push({ label: '43 cenário "ideal" (sem reduções)', capex: 18000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 0, inadimplencia_pct: 0, opex_pct: 0, custo_seguro: 200, custo_manutencao: 0, impostos_pct: 0, taxa_desconto_aa_pct: 10 })
  list.push({ label: '44 cenário "stress" (todas reduções)', capex: 30000, mensalidade: 900, desconto_pct: 10, prazo: 24, reajuste_anual_pct: 0, inadimplencia_pct: 10, opex_pct: 10, custo_seguro: 350, custo_manutencao: 2000, impostos_pct: 8, taxa_desconto_aa_pct: 18 })
  list.push({ label: '45 prazo 12m + reajuste alto', capex: 14000, mensalidade: 1500, desconto_pct: 0, prazo: 12, reajuste_anual_pct: 8, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 200, custo_manutencao: 200, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '46 prazo 144m + manutenção alta', capex: 45000, mensalidade: 1800, desconto_pct: 5, prazo: 144, reajuste_anual_pct: 5, inadimplencia_pct: 3, opex_pct: 3, custo_seguro: 600, custo_manutencao: 8000, impostos_pct: 4, taxa_desconto_aa_pct: 10 })
  list.push({ label: '47 com VRG no fim', capex: 25000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 300, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10, vrg: 5000 })
  list.push({ label: '48 com VRG alto no fim', capex: 25000, mensalidade: 1100, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 300, custo_manutencao: 600, impostos_pct: 4, taxa_desconto_aa_pct: 10, vrg: 12000 })
  list.push({ label: '49 receita exatamente igual a custo (lucro 0)', capex: 36000, mensalidade: 1000, desconto_pct: 0, prazo: 36, reajuste_anual_pct: 0, inadimplencia_pct: 0, opex_pct: 0, custo_seguro: 0, custo_manutencao: 0, impostos_pct: 0, taxa_desconto_aa_pct: 10 })
  list.push({ label: '50 prazo 60m, reajuste 4%, taxa desconto baixa', capex: 25000, mensalidade: 1200, desconto_pct: 5, prazo: 60, reajuste_anual_pct: 4, inadimplencia_pct: 2, opex_pct: 3, custo_seguro: 300, custo_manutencao: 1000, impostos_pct: 4, taxa_desconto_aa_pct: 6 })

  return list
}

const SCENARIOS = makeScenarios()

// ─── Sanity ───────────────────────────────────────────────────────────────────

describe('Auditoria Leasing — sanity', () => {
  it('gera exatamente 50 cenários', () => {
    expect(SCENARIOS).toHaveLength(50)
  })
})

// ─── Auditoria principal: KPIs do motor vs. referência ────────────────────────

describe('Auditoria Leasing — 50 cenários: KPIs computeProjectKPIs ≡ referência', () => {
  for (const s of SCENARIOS) {
    it(s.label, () => {
      // VRG não é suportado pelo motor atual — quando presente, apenas o
      // cálculo de referência o inclui. Pulamos a comparação para esses casos
      // (mas validamos a referência separadamente em outro grupo abaixo).
      if (s.vrg && s.vrg > 0) return

      const form = buildForm(s)
      const ref = expectedReference(s)

      const kpis = computeProjectKPIs(form, 'leasing', s.prazo, null, {
        impostos_percent: s.impostos_pct,
        ...(s.taxa_desconto_aa_pct != null
          ? { taxa_desconto_aa_pct: s.taxa_desconto_aa_pct }
          : {}),
      })

      // ROI deve sempre coincidir
      expect(kpis.roi_pct).toBeCloseTo(ref.roi, 4)

      // Payback (em meses) — comparamos com tolerância de 1 mês para acomodar
      // o método de interpolação (proporcional dentro do mês).
      if (ref.payback != null && kpis.payback_meses != null) {
        expect(Math.abs(kpis.payback_meses - ref.payback)).toBeLessThanOrEqual(1)
      } else {
        expect(kpis.payback_meses).toBe(ref.payback)
      }

      // TIR — quando ambos retornam número, devem coincidir; quando ref é
      // null (sem mudança de sinal), motor também deve ser null.
      if (ref.tirAnualPct == null) {
        expect(kpis.tir_pct).toBe(null)
      } else {
        expect(kpis.tir_pct).not.toBeNull()
        expect(kpis.tir_pct!).toBeCloseTo(ref.tirAnualPct, 2)
      }

      // VPL
      if (ref.vpl == null) {
        expect(kpis.vpl).toBe(null)
      } else {
        expect(kpis.vpl).not.toBeNull()
        expect(kpis.vpl!).toBeCloseTo(ref.vpl, 1)
      }
    })
  }
})

// ─── Verificações específicas de regras de negócio ────────────────────────────

describe('Regras de negócio Leasing — impacto de premissas em KPIs', () => {
  const base: LeasingScenario = {
    label: 'base',
    capex: 20000,
    mensalidade: 1100,
    desconto_pct: 0,
    prazo: 36,
    reajuste_anual_pct: 0,
    inadimplencia_pct: 0,
    opex_pct: 0,
    custo_seguro: 200,
    custo_manutencao: 0,
    impostos_pct: 4,
    taxa_desconto_aa_pct: 10,
  }

  function kpisOf(s: LeasingScenario) {
    const form = buildForm(s)
    return computeProjectKPIs(form, 'leasing', s.prazo, null, {
      impostos_percent: s.impostos_pct,
      ...(s.taxa_desconto_aa_pct != null
        ? { taxa_desconto_aa_pct: s.taxa_desconto_aa_pct }
        : {}),
    })
  }

  it('reajuste anual > 0 aumenta receita líquida (e portanto ROI)', () => {
    const semReajuste = kpisOf({ ...base, reajuste_anual_pct: 0 })
    const comReajuste = kpisOf({ ...base, reajuste_anual_pct: 5 })
    expect(comReajuste.roi_pct!).toBeGreaterThan(semReajuste.roi_pct!)
    expect(comReajuste.vpl!).toBeGreaterThan(semReajuste.vpl!)
  })

  it('reajuste anual > 0 antecipa o payback', () => {
    const semReajuste = kpisOf({ ...base, reajuste_anual_pct: 0, prazo: 60 })
    const comReajuste = kpisOf({ ...base, reajuste_anual_pct: 6, prazo: 60 })
    // Receita maior → recupera investimento mais cedo (payback ≤)
    expect(comReajuste.payback_meses!).toBeLessThanOrEqual(semReajuste.payback_meses!)
  })

  it('inadimplência reduz receita líquida (ROI cai)', () => {
    const baseRoi = kpisOf({ ...base, inadimplencia_pct: 0 }).roi_pct!
    const altaInad = kpisOf({ ...base, inadimplencia_pct: 10 }).roi_pct!
    expect(altaInad).toBeLessThan(baseRoi)
  })

  it('opex reduz lucro / ROI', () => {
    const semOpex = kpisOf({ ...base, opex_pct: 0 }).roi_pct!
    const comOpex = kpisOf({ ...base, opex_pct: 10 }).roi_pct!
    expect(comOpex).toBeLessThan(semOpex)
  })

  it('manutenção reduz lucro / ROI / VPL', () => {
    const semManu = kpisOf({ ...base, custo_manutencao: 0 })
    const comManu = kpisOf({ ...base, custo_manutencao: 5000 })
    expect(comManu.roi_pct!).toBeLessThan(semManu.roi_pct!)
    expect(comManu.vpl!).toBeLessThan(semManu.vpl!)
  })

  it('seguro entra como CAPEX e reduz ROI', () => {
    const semSeguro = kpisOf({ ...base, custo_seguro: 0 }).roi_pct!
    const comSeguro = kpisOf({ ...base, custo_seguro: 2000 }).roi_pct!
    expect(comSeguro).toBeLessThan(semSeguro)
  })

  it('desconto ao cliente reduz mensalidade efetiva e ROI', () => {
    const semDesc = kpisOf({ ...base, desconto_pct: 0 }).roi_pct!
    const comDesc = kpisOf({ ...base, desconto_pct: 20 }).roi_pct!
    expect(comDesc).toBeLessThan(semDesc)
  })

  it('VPL fica negativo quando taxa de desconto é muito alta para o fluxo', () => {
    const cenario: LeasingScenario = {
      ...base,
      capex: 60000,
      mensalidade: 900,
      prazo: 36,
      reajuste_anual_pct: 0,
      taxa_desconto_aa_pct: 30,
    }
    const k = kpisOf(cenario)
    expect(k.vpl).not.toBeNull()
    expect(k.vpl!).toBeLessThan(0)
  })

  it('VPL é null quando taxa de desconto não é fornecida', () => {
    const k = kpisOf({ ...base, taxa_desconto_aa_pct: null })
    expect(k.vpl).toBe(null)
  })

  it('TIR é null quando não há mudança de sinal (somente saídas)', () => {
    // Receita totalmente consumida: 100% de inadimplência → fluxos = -capex, 0,0,...
    const cenario: LeasingScenario = {
      ...base,
      inadimplencia_pct: 50,
      opex_pct: 50, // soma supera 1 → fator líquido = 0
      custo_manutencao: 0,
    }
    const k = kpisOf(cenario)
    expect(k.tir_pct).toBe(null)
  })
})

// ─── Validação da fórmula VPL ─────────────────────────────────────────────────

describe('Fórmula VPL — Σ FC_t / (1 + i)^t', () => {
  it('VPL com parcelas mensais constantes coincide com soma manual', () => {
    const parcela = 1000
    const taxaMensal = 0.02 // 2 % a.m.
    const meses = 24
    const investimento = 10000

    let vplManual = -investimento
    for (let t = 1; t <= meses; t++) {
      vplManual += parcela / Math.pow(1 + taxaMensal, t)
    }

    const fluxos = [-investimento, ...Array<number>(meses).fill(parcela)]
    const vplLib = computeNPV(fluxos, taxaMensal)

    expect(vplLib).toBeCloseTo(vplManual, 6)
  })

  it('VPL com VRG no fim acrescenta VRG/(1+i)^n', () => {
    const parcela = 1000
    const vrg = 5000
    const taxaMensal = 0.02
    const meses = 24
    const investimento = 10000

    let vplComVrg = -investimento
    for (let t = 1; t <= meses; t++) {
      vplComVrg += parcela / Math.pow(1 + taxaMensal, t)
    }
    vplComVrg += vrg / Math.pow(1 + taxaMensal, meses)

    const fluxos = [-investimento, ...Array<number>(meses).fill(parcela)]
    fluxos[fluxos.length - 1]! += vrg
    const vplLib = computeNPV(fluxos, taxaMensal)

    expect(vplLib).toBeCloseTo(vplComVrg, 6)
  })

  it('Conversão anual → mensal: (1+anual)^(1/12) − 1', () => {
    const anualPct = 12
    const mensal = toMonthlyRate(anualPct)
    const esperado = Math.pow(1 + 0.12, 1 / 12) - 1
    expect(mensal).toBeCloseTo(esperado, 10)
  })
})

// ─── Validação isolada da fórmula com VRG ─────────────────────────────────────

describe('Cenários com VRG — referência valida a fórmula VPL = VPL(parcelas) + VRG/(1+i)^n', () => {
  // Cenários 47 e 48 incluem VRG e são pulados na auditoria principal porque o
  // motor atual (`computeProjectKPIs`) ainda não modela VRG. Aqui validamos
  // que o cálculo de referência aplica a fórmula correta:
  //   VPL_total = Σ FC_t/(1+i)^t  +  VRG/(1+i)^n
  for (const s of SCENARIOS.filter((sc) => sc.vrg && sc.vrg > 0)) {
    it(`${s.label}: VPL referência ≡ VPL(parcelas) + VRG/(1+i)^n`, () => {
      const ref = expectedReference(s)
      // Recalcula o cenário SEM VRG para isolar o efeito
      const semVrg = expectedReference({ ...s, vrg: 0 })

      expect(ref.vpl).not.toBeNull()
      expect(semVrg.vpl).not.toBeNull()

      // Valor presente do VRG no fim do contrato
      const taxaMensal = toMonthlyRate(s.taxa_desconto_aa_pct ?? 0)
      const vrgPresente = (s.vrg ?? 0) / Math.pow(1 + taxaMensal, s.prazo)

      expect(ref.vpl!).toBeCloseTo(semVrg.vpl! + vrgPresente, 1)
    })

    it(`${s.label}: payback com VRG ≤ payback sem VRG (entrada extra antecipa retorno)`, () => {
      const comVrg = expectedReference(s)
      const semVrg = expectedReference({ ...s, vrg: 0 })
      // Em ambos casos o payback intermediário pode ocorrer no mesmo mês,
      // mas o VRG nunca pode atrasar o payback.
      if (comVrg.payback != null && semVrg.payback != null) {
        expect(comVrg.payback).toBeLessThanOrEqual(semVrg.payback)
      }
    })
  }
})



describe('computeProjectFinancialState — overrides não afetam KPIs (KPIs read-only)', () => {
  it('overrides em KPIs ainda funcionam no motor (UI desabilita, mas API mantém)', () => {
    // Documenta o comportamento: overrides ainda são respeitados pelo motor;
    // a UI de leasing simplesmente não expõe o controle de edição (ver
    // `ProjectFinanceLeasingForm`). Garantimos que `effective.payback_meses`
    // reflete o override quando aplicado, e `calculated.payback_meses` reflete
    // o valor calculado.
    const form = buildForm(SCENARIOS[4]!) // prazo 60m, reajuste 4%
    const overrides = { payback_meses: 99 }
    const { calculated, effective } = computeProjectFinancialState(
      form,
      'leasing',
      60,
      null,
      overrides,
      { impostos_percent: 4, taxa_desconto_aa_pct: 10 },
    )
    expect(effective.payback_meses).toBe(99)
    expect(calculated.payback_meses).not.toBe(99)
  })

  it('Sem overrides, effective ≡ calculated', () => {
    const form = buildForm(SCENARIOS[2]!) // prazo 36m, reajuste 4%
    const { calculated, effective } = computeProjectFinancialState(
      form,
      'leasing',
      36,
      null,
      {},
      { impostos_percent: 4, taxa_desconto_aa_pct: 10 },
    )
    expect(effective.roi_pct).toBe(calculated.roi_pct)
    expect(effective.payback_meses).toBe(calculated.payback_meses)
    expect(effective.tir_pct).toBe(calculated.tir_pct)
    expect(effective.vpl).toBe(calculated.vpl)
  })
})

// ─── computeReceitaTotalBruta — fórmula e reatividade ────────────────────────

describe('computeReceitaTotalBruta — receita bruta total reativa', () => {
  it('reajuste = 0 → mensalidade × prazo', () => {
    expect(computeReceitaTotalBruta(1000, 36, 0)).toBeCloseTo(36000, 6)
  })

  it('reajuste = 0 → equivalente a todos os 50 cenários sem reajuste', () => {
    for (const s of SCENARIOS.filter((sc) => sc.reajuste_anual_pct === 0)) {
      const m = mensalidadeComDesconto(s)
      const esperado = m * s.prazo
      expect(computeReceitaTotalBruta(m, s.prazo, 0)).toBeCloseTo(esperado, 6)
    }
  })

  it('reajuste > 0 → receita bruta é maior que mensalidade × prazo', () => {
    const base = computeReceitaTotalBruta(1000, 60, 0)
    const comReajuste = computeReceitaTotalBruta(1000, 60, 5)
    expect(comReajuste).toBeGreaterThan(base)
  })

  it('reajuste aplica (1+r)^⌊t/12⌋ corretamente (prazo 24m, reajuste 6%)', () => {
    const m = 1000
    const r = 0.06
    let esperado = 0
    for (let t = 0; t < 24; t++) {
      esperado += m * Math.pow(1 + r, Math.floor(t / 12))
    }
    expect(computeReceitaTotalBruta(1000, 24, 6)).toBeCloseTo(esperado, 6)
  })

  it('computeProjectFinancialState expõe receita_total_bruta em calculated', () => {
    const s = SCENARIOS[4]! // prazo 60m, reajuste 4%
    const m = mensalidadeComDesconto(s)
    const form = buildForm(s)
    const { calculated } = computeProjectFinancialState(
      form,
      'leasing',
      s.prazo,
      null,
      {},
      { impostos_percent: s.impostos_pct, taxa_desconto_aa_pct: s.taxa_desconto_aa_pct ?? undefined },
    )
    const esperado = computeReceitaTotalBruta(m, s.prazo, s.reajuste_anual_pct)
    expect(calculated.receita_total_bruta).not.toBeNull()
    expect(calculated.receita_total_bruta!).toBeCloseTo(esperado, 4)
  })

  it('receita_total_bruta aumenta quando reajuste aumenta (reatividade)', () => {
    const form0 = { ...buildForm(SCENARIOS[4]!), reajuste_anual_pct: 0 }
    const form4 = { ...buildForm(SCENARIOS[4]!), reajuste_anual_pct: 4 }
    const form8 = { ...buildForm(SCENARIOS[4]!), reajuste_anual_pct: 8 }
    const params = { impostos_percent: 4 }
    const { calculated: c0 } = computeProjectFinancialState(form0, 'leasing', 60, null, {}, params)
    const { calculated: c4 } = computeProjectFinancialState(form4, 'leasing', 60, null, {}, params)
    const { calculated: c8 } = computeProjectFinancialState(form8, 'leasing', 60, null, {}, params)
    expect(c4.receita_total_bruta!).toBeGreaterThan(c0.receita_total_bruta!)
    expect(c8.receita_total_bruta!).toBeGreaterThan(c4.receita_total_bruta!)
  })

  it('receita_total_bruta é null quando mensalidade_base não está disponível', () => {
    const { calculated } = computeProjectFinancialState(
      { reajuste_anual_pct: 4 },
      'leasing',
      60,
      null,
      {},
      { impostos_percent: 4 },
    )
    expect(calculated.receita_total_bruta).toBeNull()
  })
})
