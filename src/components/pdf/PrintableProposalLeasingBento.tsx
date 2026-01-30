import React from 'react'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { PrintLayout } from '../pdf/PrintLayout'
import { BentoCard, BentoCardContent, BentoCardTitle } from '../pdf/BentoCard'
import { formatNumberBRWithOptions, formatMoneyBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import {
  Wallet,
  TrendingDown,
  ShieldCheck,
  Sun,
  Check,
  HardDrive,
  Zap,
  Leaf,
  FileText,
  PenLine,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

interface PrintableProposalLeasingBentoProps extends PrintableProposalProps {
  // Additional props if needed
}

const sanitize = (text?: string | null): string => {
  if (!text) return ''
  return String(text).replace(/[<>"'&]/g, (match) => {
    const escapes: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '&': '&amp;',
    }
    return escapes[match] || match
  })
}

const formatKwp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
  return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`
}

const formatKwhMes = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
  return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh/mês`
}

const formatArea = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
  return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} m²`
}

const formatPercent = (value?: number) => {
  if (!Number.isFinite(value)) return '—'
  return formatPercentBRWithDigits(value / 100, 1)
}

const Header: React.FC<{ budgetId?: string }> = ({ budgetId }) => {
  return (
    <div className="col-span-12 flex h-16 items-center justify-between">
      <img src="/brand/logo-header.svg" alt="SolarInvest" className="h-6 w-auto" />
      <div className="text-xs font-semibold text-slate-500">
        ID da Proposta: <span className="text-slate-800">{budgetId ? `#${sanitize(budgetId)}` : '—'}</span>
      </div>
    </div>
  )
}

const HeroSection: React.FC<{ clienteNome: string }> = ({ clienteNome }) => {
  return (
    <BentoCard
      colSpan="col-span-12"
      className="relative overflow-hidden border-none bg-slate-900 text-white shadow-none"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#FDB81333,_transparent_60%)]" />
      <div className="relative z-10 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">SolarInvest Premium</p>
        <h1 className="text-3xl font-bold">Proposta de Leasing Solar: {clienteNome}</h1>
        <p className="max-w-2xl text-sm text-white/80">
          Uma solução completa de energia renovável com investimento inicial zero, economia imediata e gestão total do
          sistema fotovoltaico.
        </p>
      </div>
    </BentoCard>
  )
}

const BenefitCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => {
  return (
    <BentoCard colSpan="col-span-3">
      <div className="flex flex-col gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-solar-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </BentoCard>
  )
}

const SpecsGrid: React.FC<{
  potenciaInstaladaKwp?: number
  geracaoMensalKwh?: number
  areaInstalacao?: number
  leasingModeloModulo?: string | null
  leasingModeloInversor?: string | null
}> = ({ potenciaInstaladaKwp, geracaoMensalKwh, areaInstalacao, leasingModeloModulo, leasingModeloInversor }) => {
  return (
    <>
      <BentoCard colSpan="col-span-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Potência</p>
        <p className="mt-2 text-4xl font-bold text-slate-800">{formatKwp(potenciaInstaladaKwp)}</p>
        <p className="text-xs text-slate-500">Sistema fotovoltaico</p>
      </BentoCard>
      <BentoCard colSpan="col-span-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Geração</p>
        <p className="mt-2 text-4xl font-bold text-slate-800">{formatKwhMes(geracaoMensalKwh)}</p>
        <p className="text-xs text-slate-500">Média mensal</p>
      </BentoCard>
      <BentoCard colSpan="col-span-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Área</p>
        <p className="mt-2 text-4xl font-bold text-slate-800">{formatArea(areaInstalacao)}</p>
        <p className="text-xs text-slate-500">Área de instalação</p>
      </BentoCard>
      <BentoCard colSpan="col-span-12">
        <BentoCardTitle className="flex items-center gap-2 text-slate-800">
          <HardDrive className="h-4 w-4 text-solar-secondary" />
          Hardware Principal
        </BentoCardTitle>
        <BentoCardContent>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-solar-success" />
              <div>
                <p className="font-semibold text-slate-800">Módulos Fotovoltaicos</p>
                <p>{leasingModeloModulo || 'Módulos Tier 1 com 25 anos de garantia'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-solar-success" />
              <div>
                <p className="font-semibold text-slate-800">Inversores</p>
                <p>{leasingModeloInversor || 'Inversores string com conectividade e monitoramento remoto'}</p>
              </div>
            </div>
          </div>
        </BentoCardContent>
      </BentoCard>
    </>
  )
}

const buildEconomiaSerie = (anos: number[], leasingROI: number[]) => {
  const anosBase = anos.length > 0 ? anos : Array.from({ length: 30 }, (_, index) => index + 1)
  return anosBase.map((ano, index) => {
    const valor = leasingROI[index] ?? 0
    const acumulado = leasingROI.slice(0, index + 1).reduce((sum, value) => sum + (value ?? 0), 0)
    return {
      ano: String(ano),
      economia: valor,
      acumulado,
    }
  })
}

const buildFluxoRow = (
  row: PrintableProposalProps['parcelasLeasing'][number] | undefined,
  fallbackIndex: number,
) => {
  if (!row) {
    return {
      mes: fallbackIndex + 1,
      tarifaCheia: 0,
      mensalidade: 0,
      economia: 0,
    }
  }

  return {
    mes: row.mes,
    tarifaCheia: row.mensalidadeCheia,
    mensalidade: row.mensalidade,
    economia: row.mensalidadeCheia - row.mensalidade,
  }
}

export const PrintableProposalLeasingBento: React.FC<PrintableProposalLeasingBentoProps> = (props) => {
  const {
    cliente,
    budgetId,
    potenciaInstaladaKwp,
    geracaoMensalKwh,
    descontoContratualPct,
    leasingPrazoContratualMeses = 60,
    leasingModeloModulo,
    leasingModeloInversor,
    areaInstalacao,
    parcelasLeasing,
    leasingValorDeMercadoEstimado,
    anos,
    leasingROI,
  } = props

  const clienteNome = sanitize(cliente.nome)
  const economiaSerie = buildEconomiaSerie(anos, leasingROI)
  const comparativoData = [
    {
      name: 'Mensal',
      distribuidora: parcelasLeasing[0]?.mensalidadeCheia ?? 0,
      solarinvest: parcelasLeasing[0]?.mensalidade ?? 0,
    },
  ]

  const fluxoRow1 = buildFluxoRow(parcelasLeasing[0], 0)
  const fluxoRow2 = buildFluxoRow(parcelasLeasing[1], 1)
  const fluxoRow3 = buildFluxoRow(parcelasLeasing[2], 2)
  const fluxoRow4 = buildFluxoRow(parcelasLeasing[3], 3)
  const fluxoRow5 = buildFluxoRow(parcelasLeasing[4], 4)
  const fluxoRow6 = buildFluxoRow(parcelasLeasing[5], 5)

  return (
    <div data-testid="proposal-bento-root" data-version="premium-v4" className="bg-slate-50">
      {/* PAGE 1 - CAPA + RESUMO + BENEFÍCIOS */}
      <PrintLayout className="break-after-page">
        <Header budgetId={budgetId} />
        <HeroSection clienteNome={clienteNome} />

        <BentoCard colSpan="col-span-12">
          <BentoCardTitle className="text-slate-800">Resumo Executivo</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Modelo</span>
                  <span className="font-semibold text-slate-800">Leasing Operacional</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Prazo Contratual</span>
                  <span className="font-semibold text-slate-800">{leasingPrazoContratualMeses} meses</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Desconto Garantido</span>
                  <span className="font-semibold text-solar-success">{formatPercent(descontoContratualPct)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Potência</span>
                  <span className="font-semibold text-slate-800">{formatKwp(potenciaInstaladaKwp)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Geração Mensal</span>
                  <span className="font-semibold text-slate-800">{formatKwhMes(geracaoMensalKwh)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Investimento Inicial</span>
                  <span className="font-semibold text-solar-success">R$ 0,00</span>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        <BenefitCard
          icon={<Wallet className="h-5 w-5" />}
          title="Investimento Zero"
          description="Instalação completa sem custo inicial."
        />
        <BenefitCard
          icon={<TrendingDown className="h-5 w-5" />}
          title="Economia Imediata"
          description="Redução na conta desde o primeiro mês."
        />
        <BenefitCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Manutenção Inclusa"
          description="Operação monitorada e manutenção integral."
        />
        <BenefitCard
          icon={<Sun className="h-5 w-5" />}
          title="Energia Limpa"
          description="Sustentabilidade com previsibilidade energética."
        />
      </PrintLayout>

      {/* PAGE 2 - DASHBOARD TÉCNICO */}
      <PrintLayout className="break-after-page">
        <Header budgetId={budgetId} />
        <BentoCard colSpan="col-span-12" className="bg-white">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-solar-primary" />
            <div>
              <h2 className="text-xl font-bold text-slate-800">Dashboard Técnico</h2>
              <p className="text-xs text-slate-500">Visão consolidada dos indicadores da usina</p>
            </div>
          </div>
        </BentoCard>
        <SpecsGrid
          potenciaInstaladaKwp={potenciaInstaladaKwp}
          geracaoMensalKwh={geracaoMensalKwh}
          areaInstalacao={areaInstalacao}
          leasingModeloModulo={leasingModeloModulo}
          leasingModeloInversor={leasingModeloInversor}
        />
      </PrintLayout>

      {/* PAGE 3 - DASHBOARD FINANCEIRO */}
      <PrintLayout className="break-after-page">
        <Header budgetId={budgetId} />
        <BentoCard colSpan="col-span-12" className="bg-white">
          <div className="flex items-center gap-3">
            <Leaf className="h-6 w-6 text-solar-success" />
            <div>
              <h2 className="text-xl font-bold text-slate-800">Dashboard Financeiro</h2>
              <p className="text-xs text-slate-500">Comparativos e projeções com base em dados reais</p>
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-7">
          <BentoCardTitle className="text-slate-800">Comparativo de Custos Mensais</BentoCardTitle>
          <div className="h-52">
            <BarChart width={420} height={200} data={comparativoData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
              <Bar dataKey="distribuidora" fill="#EF4444" radius={[8, 8, 0, 0]} name="Distribuidora" />
              <Bar dataKey="solarinvest" fill="#10B981" radius={[8, 8, 0, 0]} name="SolarInvest" />
            </BarChart>
          </div>
          <p className="text-xs text-slate-500">
            Base mensal considerando a tarifa cheia da distribuidora versus o leasing SolarInvest.
          </p>
        </BentoCard>

        <BentoCard colSpan="col-span-5">
          <BentoCardTitle className="text-slate-800">Economia Acumulada (30 anos)</BentoCardTitle>
          <div className="h-52">
            <AreaChart width={300} height={200} data={economiaSerie} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="economia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FDB813" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#FDB813" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="ano" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
              <Area type="monotone" dataKey="acumulado" stroke="#FDB813" fill="url(#economia)" strokeWidth={2} />
            </AreaChart>
          </div>
          <p className="text-xs text-slate-500">Projeção acumulada com base no histórico de ROI informado.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-12">
          <BentoCardTitle className="flex items-center gap-2 text-slate-800">
            <FileText className="h-4 w-4 text-solar-secondary" />
            Fluxo de Caixa (amostra mensal)
          </BentoCardTitle>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Mês</th>
                  <th className="px-3 py-2 font-semibold">Distribuidora</th>
                  <th className="px-3 py-2 font-semibold">SolarInvest</th>
                  <th className="px-3 py-2 font-semibold">Economia</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow1.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow1.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow1.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow1.economia)}</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow2.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow2.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow2.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow2.economia)}</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow3.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow3.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow3.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow3.economia)}</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow4.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow4.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow4.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow4.economia)}</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow5.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow5.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow5.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow5.economia)}</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-3 py-2">{fluxoRow6.mes}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow6.tarifaCheia)}</td>
                  <td className="px-3 py-2">{formatMoneyBR(fluxoRow6.mensalidade)}</td>
                  <td className="px-3 py-2 text-solar-success">{formatMoneyBR(fluxoRow6.economia)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>

        {leasingValorDeMercadoEstimado ? (
          <BentoCard colSpan="col-span-12" className="bg-solar-secondary text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-white/70">Valor da usina ao final</p>
                <p className="text-2xl font-bold">{formatMoneyBR(leasingValorDeMercadoEstimado)}</p>
              </div>
              <p className="text-xs text-white/80">
                Patrimônio transferido ao cliente após {leasingPrazoContratualMeses} meses.
              </p>
            </div>
          </BentoCard>
        ) : null}
      </PrintLayout>

      {/* PAGE 4 - TERMOS LEGAIS E ASSINATURA */}
      <PrintLayout>
        <Header budgetId={budgetId} />
        <BentoCard colSpan="col-span-12" className="bg-white">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-solar-secondary" />
            <div>
              <h2 className="text-xl font-bold text-slate-800">Termos Legais</h2>
              <p className="text-xs text-slate-500">Condições essenciais para a formalização do contrato</p>
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-12" className="bg-slate-100">
          <BentoCardContent className="text-xs text-slate-600">
            <ul className="space-y-2">
              <li>
                Reajuste anual conforme índice previsto em contrato. Valores e projeções podem variar de acordo com a
                tarifa vigente da distribuidora.
              </li>
              <li>
                Proposta válida por 30 dias, sujeita à análise de crédito e vistoria técnica do local de instalação.
              </li>
              <li>
                O cronograma de implantação depende da homologação junto à concessionária e disponibilidade de
                equipamentos.
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <BentoCardTitle className="flex items-center gap-2 text-slate-800">
            <PenLine className="h-4 w-4 text-solar-secondary" />
            Assinatura do Cliente
          </BentoCardTitle>
          <div className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">Nome e assinatura</div>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <BentoCardTitle className="flex items-center gap-2 text-slate-800">
            <PenLine className="h-4 w-4 text-solar-secondary" />
            Assinatura SolarInvest
          </BentoCardTitle>
          <div className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">Representante legal</div>
        </BentoCard>
      </PrintLayout>
    </div>
  )
}
