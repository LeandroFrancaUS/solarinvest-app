import React from 'react'
import type { SimulacaoLiteResultado, SimulacaoLiteSerieAnoItem } from '../../lib/finance/simulacaoEngineLite'
import type { RecomendacaoLite } from '../../lib/ai/simulacaoRecommenderLite'
import { RevenueCostProfitChartLite } from '../simulacoes/lite/RevenueCostProfitChartLite'
import { TarifaForecastChartLite } from '../simulacoes/lite/TarifaForecastChartLite'
import { RoiByYearChartLite } from '../simulacoes/lite/RoiByYearChartLite'
import { formatMoneyBR, formatNumberBRWithOptions } from '../../lib/locale/br-number'

export type SimulationReportLiteProps = {
  resultado: SimulacaoLiteResultado
  recomendacao?: RecomendacaoLite | null
}

const formatPercent = (value: number): string =>
  `${formatNumberBRWithOptions(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginBottom: '24px' }}>
    <h3 style={{ marginBottom: '8px', fontSize: '18px', color: '#0f172a' }}>{title}</h3>
    {children}
  </section>
)

const KpiRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const ChartSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
    <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>{title}</h4>
    {children}
  </div>
)

export const SimulationReportLite: React.FC<SimulationReportLiteProps> = ({ resultado, recomendacao }) => {
  const { kpisEssenciais, kpisAvancados } = resultado
  const baseSerie: SimulacaoLiteSerieAnoItem[] = resultado.cenarios.base.serieAno
  return (
    <div
      style={{
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#0f172a',
        padding: '32px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: '32px', borderBottom: '2px solid #f97316', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>SolarInvest — Relatório LITE</h1>
        <p style={{ margin: 0, color: '#475569' }}>Resumo financeiro e projeções de tarifa para o cenário base.</p>
      </header>
      <Section title="KPIs essenciais">
        <KpiRow label="CAPEX total" value={formatMoneyBR(kpisEssenciais.capexTotal)} />
        <KpiRow label="OPEX mensal" value={formatMoneyBR(kpisEssenciais.opexMensal)} />
        <KpiRow label="OPEX anual" value={formatMoneyBR(kpisEssenciais.opexAnual)} />
        <KpiRow label="Lucro líquido mensal" value={formatMoneyBR(kpisEssenciais.lucroLiquidoMensal)} />
        <KpiRow label="Lucro líquido anual" value={formatMoneyBR(kpisEssenciais.lucroLiquidoAnual)} />
        <KpiRow label="Lucro total" value={formatMoneyBR(kpisEssenciais.lucroLiquidoTotal)} />
        <KpiRow label="ROI" value={formatPercent(kpisEssenciais.roiPercent)} />
        <KpiRow label="Payback" value={`${formatNumberBRWithOptions(kpisEssenciais.paybackMeses, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} meses`} />
      </Section>
      <Section title="KPIs avançados">
        <KpiRow label="VPL" value={formatMoneyBR(kpisAvancados.vpl)} />
        <KpiRow label="TIR" value={kpisAvancados.tir ? formatPercent(kpisAvancados.tir * 100) : '—'} />
        <KpiRow label="LCOE" value={`${formatMoneyBR(kpisAvancados.lcoe)} / kWh`} />
      </Section>
      <Section title="Gráficos">
        <ChartSection title="Receita, OPEX e Lucro">
          <RevenueCostProfitChartLite data={baseSerie} />
        </ChartSection>
        <ChartSection title="Tarifa projetada">
          <TarifaForecastChartLite data={baseSerie} />
        </ChartSection>
        <ChartSection title="ROI acumulado">
          <RoiByYearChartLite data={baseSerie} />
        </ChartSection>
      </Section>
      {recomendacao ? (
        <Section title="Sugestão de plano">
          <p style={{ margin: 0 }}>{recomendacao.motivoResumo}</p>
        </Section>
      ) : null}
      <footer style={{ marginTop: '32px', fontSize: '12px', color: '#475569' }}>
        <p>
          Este relatório LITE apresenta projeções simplificadas baseadas em dados da ANEEL e parâmetros de investimento
          fornecidos pela equipe SolarInvest. Para análises detalhadas utilize o módulo completo.
        </p>
      </footer>
    </div>
  )
}
