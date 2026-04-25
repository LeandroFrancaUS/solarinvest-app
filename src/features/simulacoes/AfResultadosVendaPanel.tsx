// src/features/simulacoes/AfResultadosVendaPanel.tsx
// Extracted from AnaliseFinanceiraSection.tsx (Subfase 2B.12.4D).
// Renders the venda results tiles (Resultados + Indicadores Financeiros) when afModo === 'venda'.

import type React from 'react'
import { Field } from '../../components/ui/Field'
import { InfoTooltip } from '../../components/InfoTooltip'
import { currency } from '../../utils/formatters'
import { MONEY_INPUT_PLACEHOLDER } from '../../lib/locale/useBRNumberField'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import type { MoneyFieldHandle } from './simulacoesTypes'

export interface AfResultadosVendaPanelProps {
  afModo: 'venda' | 'leasing'
  afValorContratoField: MoneyFieldHandle
  afComissaoMinimaPercent: number
  setAfComissaoMinimaPercent: (v: number) => void
  afValorContrato: number
  afMargemLiquidaMinima: number
  afMargemLiquidaVenda: number
  afTaxaDesconto: number
  analiseFinanceiraResult: AnaliseFinanceiraOutput
  selectNumberInputOnFocus: (e: React.FocusEvent<HTMLInputElement>) => void
}

export function AfResultadosVendaPanel({
  afModo,
  afValorContratoField,
  afComissaoMinimaPercent,
  setAfComissaoMinimaPercent,
  afValorContrato,
  afMargemLiquidaMinima,
  afMargemLiquidaVenda,
  afTaxaDesconto,
  analiseFinanceiraResult,
  selectNumberInputOnFocus,
}: AfResultadosVendaPanelProps) {
  return (
    <>
      {/* Venda results — hidden for leasing */}
      {afModo === 'venda' && analiseFinanceiraResult.custo_variavel_total_rs != null ? (
        <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
          <h4>Resultados</h4>
          {afModo === 'venda' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <Field label="Valor do Contrato (R$)">
                <input
                  ref={afValorContratoField.ref}
                  type="text"
                  inputMode="decimal"
                  value={afValorContratoField.text}
                  style={{ outline: '2px solid var(--color-accent, #2563eb)', borderRadius: '4px' }}
                  onChange={afValorContratoField.handleChange}
                  onBlur={afValorContratoField.handleBlur}
                  onFocus={afValorContratoField.handleFocus}
                  placeholder={MONEY_INPUT_PLACEHOLDER}
                />
              </Field>
              <Field label="Comissão mínima (%)">
                <input
                  type="number"
                  value={afComissaoMinimaPercent}
                  min={0}
                  max={100}
                  onChange={(e) => setAfComissaoMinimaPercent(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
            </div>
          ) : null}
          <div className="info-inline">
            <span className="pill">Custo variável total <InfoTooltip text="Soma de todos os custos diretos do projeto: kit, frete, descarregamento, hospedagem, material CA e mão de obra estimada." /> <strong>{currency(analiseFinanceiraResult.custo_variavel_total_rs)}</strong></span>
            {afValorContrato > 0 ? (
              <>
                <span className="pill">Margem bruta <InfoTooltip text="Diferença entre o valor do contrato e o custo variável total. Representa o valor disponível para cobrir impostos, custos fixos e gerar lucro." /> <strong>{currency(analiseFinanceiraResult.margem_rs ?? 0)}</strong></span>
                <span className="pill">Impostos <InfoTooltip text="Valor estimado de impostos sobre o faturamento, calculado com base na alíquota configurada." /> <strong>{currency(analiseFinanceiraResult.impostos_rs ?? 0)}</strong></span>
                <span className="pill">Lucro s/ comissão <InfoTooltip text="Lucro líquido antes de descontar a comissão do vendedor. Resultado da margem bruta menos impostos e custos fixos." /> <strong>{currency(analiseFinanceiraResult.lucro_liquido_sem_comissao_rs ?? 0)}</strong></span>
                <span className="pill">Margem s/ comissão <InfoTooltip text="Percentual de margem líquida sobre o valor do contrato, antes de considerar a comissão do vendedor." /> <strong>{(analiseFinanceiraResult.margem_liquida_sem_comissao_percent ?? 0).toFixed(2)}%</strong></span>
                <span className="pill">Comissão <InfoTooltip text="Comissão mínima aplicada sobre o valor do contrato somente quando a margem líquida sem comissão já atinge a margem mínima." /> <strong>{(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(2)}% = {currency(analiseFinanceiraResult.comissao_rs ?? 0)}</strong></span>
                <span className="pill">Custo total real <InfoTooltip text="Custo total efetivo do projeto incluindo custos variáveis, impostos, custos fixos rateados e comissão do vendedor." /> <strong>{currency(analiseFinanceiraResult.custo_total_real_rs ?? 0)}</strong></span>
                <span className="pill">Lucro líquido final <InfoTooltip text="Lucro efetivo após deduzir todos os custos (variáveis, impostos, fixos e comissão) do valor do contrato." /> <strong>{currency(analiseFinanceiraResult.lucro_liquido_final_rs ?? 0)}</strong></span>
                <span className="pill">Margem líquida final <InfoTooltip text="Percentual de lucro líquido sobre o valor do contrato, após todos os custos incluindo comissão. Indica a rentabilidade real do projeto." /> <strong>{(analiseFinanceiraResult.margem_liquida_final_percent ?? 0).toFixed(2)}%</strong></span>
                <span className="pill">Desconto máximo <InfoTooltip text="Percentual máximo de desconto sobre o valor do contrato para manter a margem líquida mínima já considerando a comissão mínima." /> <strong>{(analiseFinanceiraResult.desconto_maximo_percent ?? 0).toFixed(2)}%</strong></span>
              </>
            ) : null}
          </div>
          {(analiseFinanceiraResult.preco_minimo_aceitavel_rs != null || analiseFinanceiraResult.preco_minimo_saudavel_rs != null) ? (
            <div className="price-band">
              <p className="price-band-title">Recomendações de Preço</p>
              <div className="price-band-row">
                {analiseFinanceiraResult.preco_minimo_aceitavel_rs != null ? (
                  <span className="pill pill--warning pill--price">
                    Preço Mín. Aceitável <InfoTooltip text={`Menor preço de venda que garante a margem líquida mínima de ${afMargemLiquidaMinima}%, sem incluir comissão do vendedor. Abaixo deste valor a venda é bloqueada.`} /> <strong>{currency(analiseFinanceiraResult.preco_minimo_aceitavel_rs)}</strong>
                  </span>
                ) : null}
                {analiseFinanceiraResult.preco_minimo_saudavel_rs != null ? (
                  <span className="pill pill--success pill--price">
                    Preço Mín. Saudável <InfoTooltip text={`Preço mínimo que garante a margem líquida mínima de ${afMargemLiquidaMinima}% e ainda cobre a comissão mínima do vendedor (${afComissaoMinimaPercent}%). Abaixo deste valor não há comissão.`} /> <strong>{currency(analiseFinanceiraResult.preco_minimo_saudavel_rs)}</strong>
                  </span>
                ) : null}
                {analiseFinanceiraResult.preco_ideal_rs != null ? (
                  <span className="pill pill--info pill--price">
                    Preço Ideal <InfoTooltip text={`Preço calculado para atingir a margem líquida alvo de ${afMargemLiquidaVenda}% após a comissão mínima do vendedor.`} /> <strong>{currency(analiseFinanceiraResult.preco_ideal_rs)}</strong>
                  </span>
                ) : null}
              </div>
              {afValorContrato > 0 ? (
                <div className="price-band-row">
                  {analiseFinanceiraResult.status_venda === 'BLOQUEAR_VENDA' ? (
                    <span className="pill pill--error">
                      🚫 VENDA NÃO APROVADA
                    </span>
                  ) : analiseFinanceiraResult.status_venda === 'SEM_COMISSAO' ? (
                    <span className="pill pill--warning">
                      ⚠️ SEM COMISSÃO
                    </span>
                  ) : analiseFinanceiraResult.status_venda === 'COMISSAO_MINIMA' ? (
                    <span className="pill pill--info">
                      💼 COMISSÃO {(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="pill pill--success">
                      ✅ VENDA SAUDÁVEL — COMISSÃO {(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(1)}%
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* KPIs */}
      {afModo === 'venda' ? (
        <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
          <h4>Indicadores Financeiros — Venda</h4>
          <div className="info-inline">
            <span className="pill">ROI <strong>{analiseFinanceiraResult.roi_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></span>
            <span className="pill">Payback <strong>{analiseFinanceiraResult.payback_meses != null ? `${analiseFinanceiraResult.payback_meses} meses` : '—'}</strong></span>
            <span className="pill">TIR mensal <InfoTooltip text="Taxa Interna de Retorno por período (mês). Não disponível quando o fluxo não tem mudança de sinal." /> <strong>{analiseFinanceiraResult.tir_mensal_percent != null ? `${analiseFinanceiraResult.tir_mensal_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
            <span className="pill">TIR anual <strong>{analiseFinanceiraResult.tir_anual_percent != null ? `${analiseFinanceiraResult.tir_anual_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
            <span className="pill">VPL <InfoTooltip text={afTaxaDesconto > 0 ? `Valor Presente Líquido com taxa de desconto de ${afTaxaDesconto}% a.a.` : 'Informe a taxa de desconto (% a.a.) acima para calcular o VPL.'} /> <strong>{analiseFinanceiraResult.vpl != null ? currency(analiseFinanceiraResult.vpl) : '—'}</strong></span>
            {analiseFinanceiraResult.payback_descontado_meses != null ? (
              <span className="pill">Payback descontado <strong>{analiseFinanceiraResult.payback_descontado_meses} meses</strong></span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
