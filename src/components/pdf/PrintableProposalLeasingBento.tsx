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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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

const CoverHeader: React.FC<{ proposalName: string; budgetId?: string }> = ({ proposalName, budgetId }) => {
  return (
    <div className="flex items-center justify-between">
      <img src="/brand/logo-header.svg" alt="SolarInvest" className="h-6 w-auto" />
      <div className="text-right">
        <p className="text-sm font-semibold text-solar-secondary">{proposalName}</p>
        <p className="text-xs text-solar-text">ID da Proposta: {budgetId ? `#${sanitize(budgetId)}` : '—'}</p>
      </div>
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
      <div className="mt-1 text-solar-primary">{icon}</div>
      <div>
        <h2 className="text-[22px] font-semibold text-solar-primary">{title}</h2>
        <p className="text-sm text-solar-text">{subtitle}</p>
      </div>
    </div>
  )
}

const TechCard: React.FC<{ icon: React.ReactNode; title: string; value: string; caption: string }> = ({
  icon,
  title,
  value,
  caption,
}) => {
  return (
    <BentoCard colSpan="col-span-3" className="bg-solar-technical">
      <div className="flex flex-col gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-solar-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-solar-secondary">{title}</p>
          <p className="text-[20px] font-semibold text-solar-secondary">{value}</p>
          <p className="text-xs text-solar-text">{caption}</p>
        </div>
      </div>
    </BentoCard>
  )
}

const BulletItem: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-solar-success" />
      <p className="text-sm text-solar-text">{text}</p>
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
  const proposalName = 'Proposta de Leasing Solar'
  const economiaSerie = buildEconomiaSerie(anos, leasingROI)
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
    <div data-testid="proposal-bento-root" data-version="premium-v5" className="bg-white">
      {/* PAGE 1 - CAPA INSTITUCIONAL */}
      <PrintLayout className="break-after-page">
        <div className="col-span-12">
          <CoverHeader proposalName={proposalName} budgetId={budgetId} />
        </div>

        <BentoCard colSpan="col-span-7" className="bg-white">
          <div className="flex flex-col gap-4">
            <h1 className="text-[30px] font-bold text-solar-secondary">{clienteNome}</h1>
            <div className="flex items-center gap-2 text-sm text-solar-text">
              <MapPin className="h-4 w-4 text-solar-primary" />
              <span>{clienteLocal}</span>
            </div>
            <div className="space-y-2 text-sm text-solar-text">
              <p>
                SolarInvest Energia • Rua Corporativa, 1000 • São Paulo, SP
              </p>
              <p>Contato: (11) 0000-0000 • comercial@solarinvest.com.br</p>
            </div>
            <div className="space-y-2 text-sm text-solar-text">
              <BulletItem text="Zero investimento inicial e previsibilidade financeira." />
              <BulletItem text="Gestão completa da usina e manutenção inclusa." />
              <BulletItem text="Economia imediata com energia limpa." />
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-5" className="bg-white">
          <div className="relative flex h-full flex-col justify-between rounded-lg bg-solar-technical p-4">
            <img src="/proposal-closing-solarinvest.svg" alt="Institucional SolarInvest" className="h-48 w-full object-contain" />
            <div className="mt-4 rounded-md bg-white p-3 text-xs text-solar-text">
              Proposta personalizada para acelerar a transição energética da sua empresa.
            </div>
          </div>
        </BentoCard>
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

        <BentoCard colSpan="col-span-12" className="bg-white">
          <BentoCardContent className="text-sm">
            Somos uma empresa dedicada a projetos solares de médio e grande porte, com foco em performance, segurança e
            governança. Operamos com engenharia própria, suporte contínuo e monitoramento remoto 24/7 para garantir
            disponibilidade máxima da usina.
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-solar-technical">
          <div className="flex flex-col gap-3">
            <BadgeCheck className="h-6 w-6 text-solar-primary" />
            <p className="text-sm font-bold text-solar-secondary">Certificações</p>
            <p className="text-xs text-solar-text">ISO 9001 • NR10 • NR35 • CREA ativo</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-solar-technical">
          <div className="flex flex-col gap-3">
            <ShieldCheck className="h-6 w-6 text-solar-primary" />
            <p className="text-sm font-bold text-solar-secondary">Diferenciais Técnicos</p>
            <p className="text-xs text-solar-text">Equipe própria, monitoramento remoto e garantia estendida.</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-solar-technical">
          <div className="flex flex-col gap-3">
            <LineChart className="h-6 w-6 text-solar-primary" />
            <p className="text-sm font-bold text-solar-secondary">Linha do Tempo</p>
            <p className="text-xs text-solar-text">+120 usinas entregues • +80 MWp instalados.</p>
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

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="h-40 rounded-md bg-gradient-to-br from-solar-primary/20 to-solar-technical" />
          <p className="mt-3 text-sm font-semibold text-solar-secondary">Centro Logístico Sul</p>
          <p className="text-xs text-solar-text">2,4 MWp • Redução de 38% no custo energético.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="h-40 rounded-md bg-gradient-to-br from-solar-success/20 to-solar-technical" />
          <p className="mt-3 text-sm font-semibold text-solar-secondary">Indústria Alimentícia Norte</p>
          <p className="text-xs text-solar-text">1,8 MWp • Operação híbrida com backup inteligente.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="h-40 rounded-md bg-gradient-to-br from-solar-primary/10 to-solar-structural" />
          <p className="mt-3 text-sm font-semibold text-solar-secondary">Parque Industrial Oeste</p>
          <p className="text-xs text-solar-text">3,1 MWp • Redução de emissões de CO₂ em 1.200 t/ano.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="h-40 rounded-md bg-gradient-to-br from-solar-success/10 to-solar-structural" />
          <p className="mt-3 text-sm font-semibold text-solar-secondary">Rede de Varejo Leste</p>
          <p className="text-xs text-solar-text">950 kWp • Economia anual superior a R$ 1,2 milhão.</p>
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

        <TechCard
          icon={<Zap className="h-4 w-4" />}
          title="Potência"
          value={formatKwp(potenciaInstaladaKwp)}
          caption="Capacidade instalada"
        />
        <TechCard
          icon={<Sun className="h-4 w-4" />}
          title="Geração Média"
          value={formatKwhMes(geracaoMensalKwh)}
          caption="Média mensal"
        />
        <TechCard
          icon={<Leaf className="h-4 w-4" />}
          title="Vida Útil"
          value="25 anos"
          caption="Garantia de performance"
        />
        <TechCard
          icon={<MapPin className="h-4 w-4" />}
          title="Área Necessária"
          value={formatArea(areaInstalacao)}
          caption="Área útil estimada"
        />

        <BentoCard colSpan="col-span-12" className="bg-white">
          <BentoCardTitle className="text-solar-secondary">Lista de Equipamentos</BentoCardTitle>
          <div className="overflow-hidden rounded-md border border-solar-structural">
            <table className="w-full text-left text-xs">
              <thead className="bg-solar-technical text-solar-text">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                  <th className="px-3 py-2 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="text-solar-text">
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Módulos</td>
                  <td className="px-3 py-2">{leasingModeloModulo || 'Módulos Tier 1 de alta eficiência'}</td>
                  <td className="px-3 py-2">Garantia de 25 anos</td>
                </tr>
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Inversores</td>
                  <td className="px-3 py-2">{leasingModeloInversor || 'Inversores com monitoramento remoto'}</td>
                  <td className="px-3 py-2">Eficiência superior a 98%</td>
                </tr>
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Acessórios</td>
                  <td className="px-3 py-2">String box, cabos e estrutura homologada</td>
                  <td className="px-3 py-2">Componentes certificados</td>
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

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="space-y-3">
            <BulletItem text="Projeto executivo completo e homologação com a concessionária." />
            <BulletItem text="Instalação, comissionamento e monitoramento da usina." />
            <BulletItem text="Manutenção preventiva e corretiva durante o contrato." />
            <BulletItem text="Gestão dos indicadores de performance e geração." />
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-6" className="bg-white">
          <div className="space-y-3">
            <BulletItem text="Seguros e garantias estendidas do sistema." />
            <BulletItem text="Suporte técnico dedicado e SLA corporativo." />
            <BulletItem text="Relatórios trimestrais de desempenho e economia." />
            <BulletItem text="Transferência do ativo ao final do contrato." />
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-12" className="bg-white">
          <SectionHeader
            title="Análise Financeira"
            subtitle="Comparativo claro com e sem o sistema SolarInvest."
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <div className="mt-4 grid grid-cols-12 gap-6">
            <div className="col-span-7">
              <p className="text-xs text-solar-text">Distribuidora (vermelho) x SolarInvest (azul).</p>
              <BarChart width={420} height={180} data={comparativoData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E0E0E0" strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
                <Legend verticalAlign="top" height={24} />
                <Bar dataKey="distribuidora" fill="#E53935" radius={[6, 6, 0, 0]} name="Distribuidora" />
                <Bar dataKey="solarinvest" fill="#1E88E5" radius={[6, 6, 0, 0]} name="SolarInvest" />
              </BarChart>
            </div>
            <div className="col-span-5">
              <p className="text-xs text-solar-text">Economia acumulada (verde).</p>
              <RechartsLineChart width={300} height={180} data={economiaSerie} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E0E0E0" strokeDasharray="3 3" />
                <XAxis dataKey="ano" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoneyBR(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#43A047"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name="Economia"
                />
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

        <BentoCard colSpan="col-span-4" className="bg-white">
          <p className="text-xs text-solar-text">Payback</p>
          <p className="text-[20px] font-semibold text-solar-secondary">18 meses</p>
          <p className="text-xs text-solar-text">Retorno rápido e previsível.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-white">
          <p className="text-xs text-solar-text">ROI Estimado</p>
          <p className="text-[20px] font-semibold text-solar-secondary">{formatPercent(roiPercent)}</p>
          <p className="text-xs text-solar-text">Economia acumulada ao longo do contrato.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-4" className="bg-white">
          <p className="text-xs text-solar-text">TIR</p>
          <p className="text-[20px] font-semibold text-solar-secondary">12,4% a.a.</p>
          <p className="text-xs text-solar-text">Retorno consistente sobre o capital.</p>
        </BentoCard>

        <BentoCard colSpan="col-span-12" className="bg-white">
          <SectionHeader
            title="Condições Comerciais e Formas de Pagamento"
            subtitle="Opções comparadas com destaque para o leasing SolarInvest."
            icon={<Wallet className="h-5 w-5" />}
          />
          <div className="mt-4 overflow-hidden rounded-md border border-solar-structural">
            <table className="w-full text-left text-xs">
              <thead className="bg-solar-technical text-solar-text">
                <tr>
                  <th className="px-3 py-2 font-semibold">Modalidade</th>
                  <th className="px-3 py-2 font-semibold">Entrada</th>
                  <th className="px-3 py-2 font-semibold">Parcela Mensal</th>
                  <th className="px-3 py-2 font-semibold">Destaque</th>
                </tr>
              </thead>
              <tbody className="text-solar-text">
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Leasing SolarInvest</td>
                  <td className="px-3 py-2">R$ 0,00</td>
                  <td className="px-3 py-2">{parcelasLeasing[0] ? formatMoneyBR(parcelasLeasing[0].mensalidade) : '—'}</td>
                  <td className="px-3 py-2 text-solar-success">Melhor custo-benefício</td>
                </tr>
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Financiamento</td>
                  <td className="px-3 py-2">20% do CAPEX</td>
                  <td className="px-3 py-2">Sob consulta</td>
                  <td className="px-3 py-2">Maior exposição financeira</td>
                </tr>
                <tr className="even:bg-solar-technical">
                  <td className="px-3 py-2">Cartão / à vista</td>
                  <td className="px-3 py-2">Integral</td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">Exige capital imediato</td>
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

        <BentoCard colSpan="col-span-12" className="bg-white">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3 text-sm text-solar-text">
              <BulletItem text="Economia garantida com reajuste previsível ao longo do contrato." />
              <BulletItem text="Cronograma sujeito à homologação da concessionária local." />
              <BulletItem text="Vistoria técnica obrigatória antes da instalação." />
            </div>
            <div className="space-y-3 text-sm text-solar-text">
              <BulletItem text="Benefícios fiscais e créditos analisados caso a caso." />
              <BulletItem text="Equipe SolarInvest acompanha todo o ciclo de vida da usina." />
              <BulletItem text="Ativo transferido ao cliente após {leasingPrazoContratualMeses} meses." />
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-12" className="bg-white">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-solar-secondary">SolarInvest Energia</p>
              <p className="text-xs text-solar-text">Rua Corporativa, 1000 • São Paulo, SP</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-solar-text">
                <Phone className="h-4 w-4 text-solar-primary" />
                <span>(11) 0000-0000 • comercial@solarinvest.com.br</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-solar-text">Assinatura do Cliente</p>
                <div className="mt-4 border-t border-solar-structural" />
              </div>
              <div>
                <p className="text-xs text-solar-text">Assinatura SolarInvest</p>
                <div className="mt-4 border-t border-solar-structural" />
              </div>
            </div>
          </div>
        </BentoCard>

        <div className="col-span-12 flex items-center justify-between">
          <img src="/brand/logo-header.svg" alt="SolarInvest" className="h-6 w-auto" />
          <div className="text-right text-xs text-solar-text">
            <p>www.solarinvest.com.br • @solarinvest</p>
            <p>ID da Proposta: {budgetId ? `#${sanitize(budgetId)}` : '—'}</p>
          </div>
        </div>
      </PrintLayout>
    </div>
  )
}
