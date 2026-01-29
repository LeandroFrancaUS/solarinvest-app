import React from 'react'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { PrintLayout } from '../pdf/PrintLayout'
import { BentoCard, BentoCardTitle, BentoCardContent } from '../pdf/BentoCard'
import { formatNumberBRWithOptions, formatMoneyBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'

interface PrintableProposalLeasingBentoProps extends PrintableProposalProps {
  // Additional props if needed
}

/**
 * Premium Bento Grid PDF for Leasing Proposals
 * 5-6 pages with modern design, no broken tables
 */
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

  // Helper formatters
  const formatKwp = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
    return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`
  }

  const formatKwhMes = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
    return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh/mês`
  }

  const formatPercent = (value?: number) => {
    if (!Number.isFinite(value)) return '—'
    return formatPercentBRWithDigits(value / 100, 1)
  }

  const formatArea = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) return '—'
    return `${formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} m²`
  }

  // Calculate accumulated savings
  const calcularEconomiaAcumulada = (anos: number[]) => {
    if (!Array.isArray(leasingROI) || leasingROI.length === 0) {
      return anos.map(ano => ({ ano, economia: 0 }))
    }
    
    return anos.map(ano => {
      const maxAno = Math.min(ano, leasingROI.length)
      const roiAte = leasingROI.slice(0, maxAno)
      const acumulado = roiAte.reduce((sum, val) => sum + (val || 0), 0)
      return { ano, economia: acumulado }
    })
  }

  const economiasPorAno = calcularEconomiaAcumulada([5, 10, 20, 30])

  // Helper to sanitize text for safe rendering
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

  return (
    <div 
      data-testid="proposal-bento-root" 
      data-version="premium-v1"
      className="bg-solar-bg"
    >
      {/* PAGE 1 - HERO COVER */}
      <PrintLayout>
        {/* Header with logo and client info */}
        <BentoCard colSpan="col-span-12" variant="highlight">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Proposta de Leasing Solar</h1>
              <p className="text-white/90 text-sm">SolarInvest - Energia Solar sob Medida</p>
            </div>
            <div className="text-right text-white/90 text-sm">
              {budgetId && <p className="font-semibold">Proposta #{sanitize(budgetId)}</p>}
              <p>{sanitize(cliente.nome)}</p>
              {cliente.cidade && cliente.uf && <p>{sanitize(cliente.cidade)}, {sanitize(cliente.uf)}</p>}
            </div>
          </div>
        </BentoCard>

        {/* Main KPIs - 3 columns */}
        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Potência Instalada</p>
            <p className="text-3xl font-bold text-solar-dark">{formatKwp(potenciaInstaladaKwp)}</p>
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Geração Mensal</p>
            <p className="text-3xl font-bold text-solar-dark">{formatKwhMes(geracaoMensalKwh)}</p>
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Desconto na Tarifa</p>
            <p className="text-3xl font-bold text-solar-brand">{formatPercent(descontoContratualPct)}</p>
          </BentoCardContent>
        </BentoCard>

        {/* How it works - 3 steps in one row */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Como Funciona</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="font-semibold text-solar-accent mb-1">1. Instalação</p>
                <p className="text-xs">Instalamos o sistema completo sem custo inicial para você</p>
              </div>
              <div>
                <p className="font-semibold text-solar-accent mb-1">2. Economia Imediata</p>
                <p className="text-xs">Você começa a economizar desde o primeiro mês com desconto garantido</p>
              </div>
              <div>
                <p className="font-semibold text-solar-accent mb-1">3. Patrimônio</p>
                <p className="text-xs">Após {leasingPrazoContratualMeses} meses, a usina é transferida para você</p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 2 - LEASING OFFER */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white mb-1">Oferta de Leasing Operacional</h2>
          <p className="text-white/80 text-sm">Energia solar sem investimento inicial</p>
        </BentoCard>

        {/* What's included */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>O Que Está Incluso</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Projeto completo de engenharia e homologação junto à distribuidora</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Equipamentos de primeira linha (módulos Tier 1 e inversores certificados)</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Instalação profissional com garantia de execução</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Monitoramento remoto em tempo real da geração</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Manutenção preventiva e corretiva durante toda a vigência</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">✓</span>
                <span>Transferência integral da usina ao final do contrato</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Key conditions */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Condições Essenciais</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600">Prazo Contratual:</span>
                <span className="font-semibold">{leasingPrazoContratualMeses} meses</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600">Desconto Garantido:</span>
                <span className="font-semibold text-solar-brand">{formatPercent(descontoContratualPct)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600">Forma de Pagamento:</span>
                <span className="font-semibold">Mensalidade fixa</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600">Investimento Inicial:</span>
                <span className="font-semibold text-green-600">R$ 0,00</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-600">Propriedade Final:</span>
                <span className="font-semibold">Transferida ao cliente</span>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Benefits highlight */}
        <BentoCard colSpan="col-span-12" variant="highlight">
          <BentoCardContent>
            <p className="text-white text-center font-semibold">
              💡 Você economiza desde o primeiro mês e ainda garante um ativo de valor ao final do contrato
            </p>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 3 - TECHNICAL SPECIFICATIONS */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Especificações Técnicas</h2>
        </BentoCard>

        {/* Technical KPIs */}
        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Potência Instalada</p>
            <p className="text-2xl font-bold text-solar-dark mb-1">{formatKwp(potenciaInstaladaKwp)}</p>
            <p className="text-xs text-slate-500">Sistema fotovoltaico</p>
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Geração Estimada</p>
            <p className="text-2xl font-bold text-solar-dark mb-1">{formatKwhMes(geracaoMensalKwh)}</p>
            <p className="text-xs text-slate-500">Média mensal</p>
          </BentoCardContent>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <BentoCardContent>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Área Estimada</p>
            <p className="text-2xl font-bold text-solar-dark mb-1">{formatArea(areaInstalacao)}</p>
            <p className="text-xs text-slate-500">Instalação fotovoltaica</p>
          </BentoCardContent>
        </BentoCard>

        {/* Hardware */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Equipamentos</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-solar-accent mb-1">Módulos Fotovoltaicos</p>
                <p className="text-slate-600">{leasingModeloModulo || 'Jinko, Maxeon ou Similares'}</p>
                <p className="text-xs text-slate-500 mt-1">Tier 1 certificados com garantia de performance</p>
              </div>
              <div>
                <p className="font-semibold text-solar-accent mb-1">Inversores</p>
                <p className="text-slate-600">{leasingModeloInversor || 'Huawei, Solis ou Similares'}</p>
                <p className="text-xs text-slate-500 mt-1">Certificação INMETRO e conectividade IoT</p>
              </div>
              <div>
                <p className="font-semibold text-solar-accent mb-1">Sistema de Monitoramento</p>
                <p className="text-slate-600">Plataforma cloud com app mobile</p>
                <p className="text-xs text-slate-500 mt-1">Acompanhamento em tempo real</p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Installation requirements */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Requisitos de Instalação</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Área livre de sombreamento significativo</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Estrutura de suporte adequada (telhado ou solo)</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Quadro elétrico acessível para conexão</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Unidade consumidora ativa na distribuidora</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Vistoria técnica aprovada pela SolarInvest</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Warning */}
        <BentoCard colSpan="col-span-12">
          <BentoCardContent>
            <p className="text-xs text-slate-500">
              <strong>Aviso:</strong> Valores estimados. A geração real pode variar conforme clima, sombreamento, degradação natural dos módulos e condições reais de instalação.
            </p>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 4 - FINANCIAL SUMMARY (NO TABLES!) */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Resumo Financeiro</h2>
        </BentoCard>

        {/* Monthly expense breakdown */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Despesa Mensal Estimada</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">Conta Distribuidora (atual)</p>
                <p className="text-2xl font-bold text-red-600">
                  {(parcelasLeasing && parcelasLeasing.length > 0) ? formatMoneyBR(parcelasLeasing[0].mensalidadeCheia) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Com SolarInvest</p>
                <p className="text-2xl font-bold text-green-600">
                  {(parcelasLeasing && parcelasLeasing.length > 0) ? formatMoneyBR(parcelasLeasing[0].mensalidade) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Economia Mensal</p>
                <p className="text-2xl font-bold text-solar-brand">
                  {(parcelasLeasing && parcelasLeasing.length > 0)
                    ? formatMoneyBR(parcelasLeasing[0].mensalidadeCheia - parcelasLeasing[0].mensalidade)
                    : '—'
                  }
                </p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Accumulated savings - CARDS instead of table */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Economia Acumulada Projetada</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-4 gap-3">
              {economiasPorAno.map(({ ano, economia }) => (
                <div key={ano} className="bg-slate-50 rounded-xl p-4 text-center break-inside-avoid">
                  <p className="text-xs text-slate-500 mb-1">{ano} {ano === 1 ? 'ano' : 'anos'}</p>
                  <p className="text-lg font-bold text-solar-dark">{formatMoneyBR(economia)}</p>
                </div>
              ))}
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Asset value projection */}
        {leasingValorDeMercadoEstimado && (
          <BentoCard colSpan="col-span-12" variant="highlight">
            <BentoCardContent>
              <div className="text-center">
                <p className="text-white/90 text-sm mb-2">Valor Estimado da Usina ao Final do Contrato</p>
                <p className="text-4xl font-bold text-white">{formatMoneyBR(leasingValorDeMercadoEstimado)}</p>
                <p className="text-white/80 text-xs mt-2">Patrimônio transferido para você</p>
              </div>
            </BentoCardContent>
          </BentoCard>
        )}

        {/* Financial disclaimer */}
        <BentoCard colSpan="col-span-12">
          <BentoCardContent>
            <p className="text-xs text-slate-500">
              <strong>Aviso:</strong> Todos os valores apresentados são estimativas baseadas no consumo histórico, irradiação média da região e tarifa vigente da distribuidora. Os valores podem variar conforme consumo real, condições climáticas e reajustes aplicados pela concessionária.
            </p>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 5 - TERMS AND RESPONSIBILITIES */}
      <PrintLayout>
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Termos Essenciais</h2>
        </BentoCard>

        {/* SolarInvest responsibilities */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Responsabilidades SolarInvest</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Instalação completa do sistema fotovoltaico</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Homologação junto à distribuidora de energia</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Garantia de equipamentos e instalação</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Manutenção preventiva e corretiva durante vigência</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Monitoramento remoto da geração</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Transferência da usina ao final do contrato</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Client responsibilities */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Responsabilidades do Cliente</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Pagamento da mensalidade acordada</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Manter a unidade consumidora ativa</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Permitir acesso para manutenções</span>
              </li>
              <li className="flex items-start">
                <span className="text-solar-brand mr-2">•</span>
                <span>Não realizar alterações no sistema sem autorização</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Key highlight */}
        <BentoCard colSpan="col-span-12" variant="highlight">
          <BentoCardContent>
            <p className="text-white text-center font-semibold text-lg">
              🏆 Ao final dos {leasingPrazoContratualMeses} meses, a usina solar é transferida integralmente para você, sem custos adicionais
            </p>
          </BentoCardContent>
        </BentoCard>

        {/* Legal disclaimer */}
        <BentoCard colSpan="col-span-12">
          <BentoCardContent>
            <p className="text-xs text-slate-500 text-center">
              Esta proposta comercial tem validade de 30 dias. A formalização está sujeita à aprovação de crédito e vistoria técnica. 
              Os valores e condições finais serão estabelecidos no contrato definitivo de leasing operacional.
            </p>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>
    </div>
  )
}
