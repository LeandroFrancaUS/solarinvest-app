import React from 'react'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { PrintLayout } from '../pdf/PrintLayout'
import { BentoCard, BentoCardContent, BentoCardTitle } from '../pdf/BentoCard'
import { formatMoneyBR, formatNumberBRWithOptions, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Leaf,
  LineChart,
  MapPin,
  Phone,
  ShieldCheck,
  Sun,
  TrendingDown,
  Wallet,
  Zap,
} from 'lucide-react'
import { Bar, BarChart, Legend, Line, LineChart as RechartsLineChart, Tooltip, XAxis, YAxis } from 'recharts'

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

const CoverHeader: React.FC<{ proposalId?: string }> = ({ proposalId }) => {
  return (
    <div className="flex items-center justify-between">
      <img src="/brand/logo-header.svg" alt="SolarInvest" className="h-8 w-auto" />
      <p className="text-xs text-slate-400">Proposta {proposalId ? `#${sanitize(proposalId)}` : ''}</p>
    </div>
  )
}

const SectionHeader: React.FC<{ title: string; subtitle: string; icon?: React.ReactNode }> = ({
  title,
  subtitle,
  icon,
}) => {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-amber-500">{icon}</div>
      <div>
        <h2 className="text-[22px] font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

const MetricCard: React.FC<{ label: string; value: string; caption?: string }> = ({ label, value, caption }) => {
  return (
    <BentoCard colSpan="col-span-4">
      <BentoCardTitle>{label}</BentoCardTitle>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {caption ? <p className="text-sm text-slate-500">{caption}</p> : null}
    </BentoCard>
  )
}

const BulletItem: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}

export const PrintableProposalLeasingBento: React.FC<PrintableProposalLeasingBentoProps> = (props) => {
  const {
    cliente,
    budgetId,
    potenciaInstaladaKwp,
    geracaoMensalKwh,
    areaInstalacao,
    leasingModeloModulo,
    leasingModeloInversor,
    descontoContratualPct,
    leasingPrazoContratualMeses = 60,
    parcelasLeasing,
    anos,
    leasingROI,
  } = props

  const clienteNome = sanitize(cliente.nome)
  const clienteLocal = cliente.cidade && cliente.uf ? `${sanitize(cliente.cidade)} - ${sanitize(cliente.uf)}` : '—'
  const economiaSerie = buildEconomiaSerie(anos, leasingROI)
  const economiaMensal = (parcelasLeasing[0]?.mensalidadeCheia ?? 0) - (parcelasLeasing[0]?.mensalidade ?? 0)
  const economiaAnual = economiaMensal * 12
  const comparativoData = [
    {
      name: 'Mensal',
      distribuidora: parcelasLeasing[0]?.mensalidadeCheia ?? 0,
      solarinvest: parcelasLeasing[0]?.mensalidade ?? 0,
    },
  ]

  const economiaTotal = leasingROI.reduce((sum, value) => sum + (value ?? 0), 0)
  const roiPercent = economiaTotal > 0 ? (economiaTotal / (parcelasLeasing[0]?.mensalidadeCheia ?? 1)) * 100 : 0

  return (
    <div data-testid="proposal-bento-root" data-version="premium-v6" className="bg-slate-50">
      {/* PAGE 1 - CAPA INSTITUCIONAL */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <CoverHeader proposalId={budgetId} />
        </div>

        <div className="col-span-12 mt-8">
          <h1 className="text-6xl font-bold tracking-tight text-slate-900">
            Transição Energética para
            <br />
            <span className="text-slate-900">{clienteNome}</span>
          </h1>
          <p className="mt-4 text-base text-slate-500">{clienteLocal}</p>
        </div>

        <div className="col-span-12 mt-8 grid grid-cols-12 gap-6">
          <MetricCard label="Potência" value={formatKwp(potenciaInstaladaKwp)} caption="Capacidade instalada" />
          <MetricCard label="Economia Anual" value={formatMoneyBR(economiaAnual)} caption="Estimativa anual" />
          <MetricCard label="Retorno" value="18 meses" caption="Payback estimado" />
        </div>
      </PrintLayout>

      {/* PAGE 2 - SOBRE A EMPRESA */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <SectionHeader
            title="Sobre a SolarInvest"
            subtitle="Especialistas em energia solar corporativa com presença nacional."
            icon={<Building2 className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-12">
          <BentoCardContent className="text-sm">
            Somos uma empresa dedicada a projetos solares de médio e grande porte, com foco em performance, segurança e
            governança. Operamos com engenharia própria, suporte contínuo e monitoramento remoto 24/7 para garantir
            disponibilidade máxima da usina.
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-slate-100">
          <div className="flex flex-col gap-3">
            <BadgeCheck className="h-6 w-6 text-amber-500" />
            <p className="text-sm font-semibold text-slate-900">Certificações</p>
            <p className="text-xs text-slate-500">ISO 9001 • NR10 • NR35 • CREA ativo</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-slate-100">
          <div className="flex flex-col gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            <p className="text-sm font-semibold text-slate-900">Diferenciais Técnicos</p>
            <p className="text-xs text-slate-500">Equipe própria, monitoramento remoto e garantia estendida.</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-slate-100">
          <div className="flex flex-col gap-3">
            <LineChart className="h-6 w-6 text-amber-500" />
            <p className="text-sm font-semibold text-slate-900">Linha do Tempo</p>
            <p className="text-xs text-slate-500">+120 usinas entregues • +80 MWp instalados.</p>
          </div>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 3 - PROJETOS REALIZADOS */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <SectionHeader
            title="Projetos Realizados"
            subtitle="Cases corporativos com alta performance energética."
            icon={<Sun className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-6">
          <div className="h-40 rounded-xl bg-gradient-to-br from-slate-100 to-white" />
          <p className="mt-4 text-sm font-semibold text-slate-900">Centro Logístico Sul</p>
          <p className="text-xs text-slate-500">2,4 MWp • Redução de 38% no custo energético.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <div className="h-40 rounded-xl bg-gradient-to-br from-slate-100 to-white" />
          <p className="mt-4 text-sm font-semibold text-slate-900">Indústria Alimentícia Norte</p>
          <p className="text-xs text-slate-500">1,8 MWp • Operação híbrida com backup inteligente.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <div className="h-40 rounded-xl bg-gradient-to-br from-slate-100 to-white" />
          <p className="mt-4 text-sm font-semibold text-slate-900">Parque Industrial Oeste</p>
          <p className="text-xs text-slate-500">3,1 MWp • Redução de emissões de CO₂ em 1.200 t/ano.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <div className="h-40 rounded-xl bg-gradient-to-br from-slate-100 to-white" />
          <p className="mt-4 text-sm font-semibold text-slate-900">Rede de Varejo Leste</p>
          <p className="text-xs text-slate-500">950 kWp • Economia anual superior a R$ 1,2 milhão.</p>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 4 - INFORMAÇÕES TÉCNICAS */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <SectionHeader
            title="Informações Técnicas da Usina"
            subtitle="Dados essenciais do sistema dimensionado para o seu negócio."
            icon={<Zap className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-3" className="bg-slate-100">
          <BentoCardTitle>Potência</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">{formatKwp(potenciaInstaladaKwp)}</p>
          <p className="text-sm text-slate-500">Capacidade instalada</p>
        </BentoCard>

        <BentoCard colSpan="col-span-3" className="bg-slate-100">
          <BentoCardTitle>Geração Média</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">{formatKwhMes(geracaoMensalKwh)}</p>
          <p className="text-sm text-slate-500">Média mensal</p>
        </BentoCard>

        <BentoCard colSpan="col-span-3" className="bg-slate-100">
          <BentoCardTitle>Vida Útil</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">25 anos</p>
          <p className="text-sm text-slate-500">Garantia de performance</p>
        </BentoCard>

        <BentoCard colSpan="col-span-3" className="bg-slate-100">
          <BentoCardTitle>Área Necessária</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">{formatArea(areaInstalacao)}</p>
          <p className="text-sm text-slate-500">Área útil estimada</p>
        </BentoCard>

        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Lista de Equipamentos</BentoCardTitle>
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Módulos</td>
                  <td className="px-4 py-3">{leasingModeloModulo || 'Módulos Tier 1 de alta eficiência'}</td>
                  <td className="px-4 py-3">Garantia de 25 anos</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Inversores</td>
                  <td className="px-4 py-3">{leasingModeloInversor || 'Inversores com monitoramento remoto'}</td>
                  <td className="px-4 py-3">Eficiência superior a 98%</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Acessórios</td>
                  <td className="px-4 py-3">String box, cabos e estrutura homologada</td>
                  <td className="px-4 py-3">Componentes certificados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 5 - SERVIÇOS INCLUSOS & ANÁLISE FINANCEIRA */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <SectionHeader
            title="Serviços Inclusos"
            subtitle="Tudo o que você precisa para operar sem preocupações."
            icon={<ClipboardList className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-6">
          <div className="space-y-3">
            <BulletItem text="Projeto executivo completo e homologação com a concessionária." />
            <BulletItem text="Instalação, comissionamento e monitoramento da usina." />
            <BulletItem text="Manutenção preventiva e corretiva durante o contrato." />
            <BulletItem text="Gestão dos indicadores de performance e geração." />
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-6">
          <div className="space-y-3">
            <BulletItem text="Seguros e garantias estendidas do sistema." />
            <BulletItem text="Suporte técnico dedicado e SLA corporativo." />
            <BulletItem text="Relatórios trimestrais de desempenho e economia." />
            <BulletItem text="Transferência do ativo ao final do contrato." />
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-12">
          <SectionHeader
            title="Análise Financeira"
            subtitle="Comparativo claro com e sem o sistema SolarInvest."
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <div className="mt-6 grid grid-cols-12 gap-6">
            <div className="col-span-7">
              <p className="text-xs text-slate-500">Distribuidora x SolarInvest.</p>
              <BarChart width={420} height={180} data={comparativoData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
                <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#64748B' }} />
                <Bar dataKey="distribuidora" fill="#E2E8F0" radius={[4, 4, 0, 0]} name="Distribuidora" />
                <Bar dataKey="solarinvest" fill="#FDB813" radius={[4, 4, 0, 0]} name="SolarInvest" />
              </BarChart>
            </div>
            <div className="col-span-5">
              <p className="text-xs text-slate-500">Economia acumulada (30 anos).</p>
              <RechartsLineChart width={300} height={180} data={economiaSerie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="ano" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
                <Line type="monotone" dataKey="acumulado" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} name="Economia" />
              </RechartsLineChart>
            </div>
          </div>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 6 - INDICADORES E CONDIÇÕES COMERCIAIS */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <SectionHeader
            title="Indicadores de Viabilidade"
            subtitle="Resultados apresentados de forma simples e objetiva."
            icon={<LineChart className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-4">
          <BentoCardTitle>Payback</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">18 meses</p>
          <p className="text-sm text-slate-500">Retorno rápido e previsível.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardTitle>ROI Estimado</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">{formatPercent(roiPercent)}</p>
          <p className="text-sm text-slate-500">Economia acumulada ao longo do contrato.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardTitle>TIR</BentoCardTitle>
          <p className="text-3xl font-bold text-slate-900">12,4% a.a.</p>
          <p className="text-sm text-slate-500">Retorno consistente sobre o capital.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-12">
          <SectionHeader
            title="Condições Comerciais e Formas de Pagamento"
            subtitle="Opções comparadas com destaque para o leasing SolarInvest."
            icon={<Wallet className="h-5 w-5" />}
          />
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Modalidade</th>
                  <th className="px-4 py-3 font-semibold">Entrada</th>
                  <th className="px-4 py-3 font-semibold">Parcela Mensal</th>
                  <th className="px-4 py-3 font-semibold">Destaque</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Leasing SolarInvest</td>
                  <td className="px-4 py-3">R$ 0,00</td>
                  <td className="px-4 py-3">{parcelasLeasing[0] ? formatMoneyBR(parcelasLeasing[0].mensalidade) : '—'}</td>
                  <td className="px-4 py-3 text-emerald-600">Melhor custo-benefício</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Financiamento</td>
                  <td className="px-4 py-3">20% do CAPEX</td>
                  <td className="px-4 py-3">Sob consulta</td>
                  <td className="px-4 py-3">Maior exposição financeira</td>
                </tr>
                <tr className="even:bg-slate-50">
                  <td className="px-4 py-3">Cartão / à vista</td>
                  <td className="px-4 py-3">Integral</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">Exige capital imediato</td>
                </tr>
              </tbody>
            </table>
          </div>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 7 - CONSIDERAÇÕES FINAIS E ASSINATURAS */}
      <PrintLayout>
        <div className="col-span-12">
          <SectionHeader
            title="Considerações Finais"
            subtitle="Proposta válida por 30 dias. Sujeita a vistoria técnica e aprovação de crédito."
            icon={<FileText className="h-5 w-5" />}
          />
        </div>

        <BentoCard colSpan="col-span-12">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3 text-sm text-slate-600">
              <BulletItem text="Economia garantida com reajuste previsível ao longo do contrato." />
              <BulletItem text="Cronograma sujeito à homologação da concessionária local." />
              <BulletItem text="Vistoria técnica obrigatória antes da instalação." />
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <BulletItem text="Benefícios fiscais e créditos analisados caso a caso." />
              <BulletItem text="Equipe SolarInvest acompanha todo o ciclo de vida da usina." />
              <BulletItem text={`Ativo transferido ao cliente após ${leasingPrazoContratualMeses} meses.`} />
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-12">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-slate-900">SolarInvest Energia</p>
              <p className="text-xs text-slate-500">Rua Corporativa, 1000 • São Paulo, SP</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Phone className="h-4 w-4 text-amber-500" />
                <span>(11) 0000-0000 • comercial@solarinvest.com.br</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Assinatura do Cliente</p>
                <div className="mt-4 border-t border-slate-200/60" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Assinatura SolarInvest</p>
                <div className="mt-4 border-t border-slate-200/60" />
              </div>
            </div>
          </div>
        </BentoCard>

        <div className="col-span-12 flex items-center justify-between">
          <img src="/brand/logo-header.svg" alt="SolarInvest" className="h-8 w-auto" />
          <div className="text-right text-xs text-slate-400">
            <p>www.solarinvest.com.br • @solarinvest</p>
            <p>Proposta {budgetId ? `#${sanitize(budgetId)}` : ''}</p>
          </div>
        </div>
      </PrintLayout>
    </div>
  )
}
