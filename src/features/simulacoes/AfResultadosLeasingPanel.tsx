// src/features/simulacoes/AfResultadosLeasingPanel.tsx
// Extracted from AnaliseFinanceiraSection.tsx (Subfase 2B.12.4E).
// Renders the five leasing result tiles when afModo === 'leasing' and custo_total_rs is set.

import { InfoTooltip } from '../../components/InfoTooltip'
import { currency } from '../../utils/formatters'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

export interface AfResultadosLeasingPanelProps {
  afModo: 'venda' | 'leasing'
  afImpostosLeasing: number
  afInadimplencia: number
  afCustoOperacional: number
  afMesesProjecao: number
  analiseFinanceiraResult: AnaliseFinanceiraOutput
  indicadorEficienciaProjeto: { score: number; classificacao: string } | null
}

export function AfResultadosLeasingPanel({
  afModo,
  afImpostosLeasing,
  afInadimplencia,
  afCustoOperacional,
  afMesesProjecao: _afMesesProjecao,
  analiseFinanceiraResult,
  indicadorEficienciaProjeto,
}: AfResultadosLeasingPanelProps) {
  if (afModo !== 'leasing' || analiseFinanceiraResult.custo_total_rs == null) {
    return null
  }

  return (
    <>
      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Composição Mensal — Leasing</h4>
        <div className="info-inline">
          <span className="pill">Mensalidade bruta <strong>{currency(analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
          <span className="pill">Impostos ({afImpostosLeasing}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afImpostosLeasing / 100)}/mês</strong></span>
          <span className="pill">Inadimplência esperada ({afInadimplencia}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afInadimplencia / 100)}/mês</strong></span>
          <span className="pill">Custo operacional ({afCustoOperacional}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afCustoOperacional / 100)}/mês</strong></span>
          <span className="pill pill--info">Receita líquida mensal <strong>{currency(analiseFinanceiraResult.receita_liquida_mensal_rs ?? analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0)}</strong></span>
          <span className="pill pill--success">Lucro mensal médio <strong>{currency(analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0)}</strong></span>
        </div>
      </div>

      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Investimento — Leasing</h4>
        <div className="info-inline">
          <span className="pill">CAPEX <strong>{currency(analiseFinanceiraResult.custo_variavel_total_rs ?? 0)}</strong></span>
          <span className="pill">Comissão / CAC <strong>{currency(analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
          <span className="pill">Seguro obrigatório <strong>{currency(analiseFinanceiraResult.seguro_rs ?? 0)}</strong></span>
          <span className="pill pill--info">Investimento total <InfoTooltip text="Investimento total = CAPEX + CAC + Seguro. Esta é a base de retorno do projeto no leasing." /> <strong>{currency(analiseFinanceiraResult.investimento_total_leasing_rs ?? 0)}</strong></span>
        </div>
      </div>

      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Retorno e Rentabilidade — Leasing</h4>
        <div className="info-inline">
          <span className="pill pill--success">Payback total <strong>{analiseFinanceiraResult.payback_total_meses != null ? `${analiseFinanceiraResult.payback_total_meses.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses` : '—'}</strong></span>
          <span className="pill">Break-even (mês) <strong>{analiseFinanceiraResult.break_even_meses != null ? `${analiseFinanceiraResult.break_even_meses.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '—'}</strong></span>
          <span className="pill">ROI <strong>{analiseFinanceiraResult.roi_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></span>
          <span className="pill">TIR anual <strong>{analiseFinanceiraResult.tir_anual_percent != null ? `${analiseFinanceiraResult.tir_anual_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
          <span className="pill">VPL <strong>{analiseFinanceiraResult.vpl != null ? currency(analiseFinanceiraResult.vpl) : '—'}</strong></span>
          <span className="pill">Payback descontado <strong>{analiseFinanceiraResult.payback_descontado_meses != null ? `${analiseFinanceiraResult.payback_descontado_meses} meses` : '—'}</strong></span>
          <span className="pill">Receita total do contrato <strong>{currency(analiseFinanceiraResult.receita_total_contrato_rs ?? analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
          <span className="pill">Lucro total do contrato <strong>{currency(analiseFinanceiraResult.lucro_total_contrato_rs ?? analiseFinanceiraResult.lucro_rs ?? 0)}</strong></span>
          <span className="pill">Múltiplo do capital <strong>{analiseFinanceiraResult.multiplo_capital_investido != null ? `${analiseFinanceiraResult.multiplo_capital_investido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : '—'}</strong></span>
        </div>
      </div>

      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Indicador de eficiência do projeto</h4>
        <div className="info-inline">
          <span className={`pill ${indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 85 ? 'pill--success' : indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 70 ? 'pill--info' : indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 50 ? 'pill--warning' : 'pill--error'}`}>
            Indicador de eficiência do projeto <strong>{indicadorEficienciaProjeto != null ? `${indicadorEficienciaProjeto.score}/100 — ${indicadorEficienciaProjeto.classificacao}` : '—'}</strong>
          </span>
          <span className="pill">Resumo composto da eficiência financeira do leasing com base em retorno, prazo e capital investido.</span>
        </div>
      </div>
    </>
  )
}
