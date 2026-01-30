import React from 'react'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { PrintLayout } from '../pdf/PrintLayout'
import { BentoCard, BentoCardTitle, BentoCardContent } from '../pdf/BentoCard'
import { BrandHeader } from '../pdf/BrandHeader'
import { KpiCard } from '../pdf/KpiCard'
import { ListCard } from '../pdf/ListCard'
import { formatNumberBRWithOptions, formatMoneyBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'

interface PrintableProposalLeasingBentoProps extends PrintableProposalProps {
  // Additional props if needed
}

/**
 * Premium Bento Grid PDF for Leasing Proposals - Version 3.1
 * Enhanced visual design with charts, illustrations, and institutional layout
 * 6 pages with modern corporate presentation
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
      data-version="premium-v3"
      className="bg-solar-bg"
    >
      {/* PAGE 1 - INSTITUTIONAL COVER */}
      <PrintLayout>
        {/* Compact logo in upper corner */}
        <div className="col-span-12 flex justify-end items-start mb-4">
          <img 
            src="/brand/logo-header.svg" 
            alt="SolarInvest" 
            className="h-8 w-auto"
          />
        </div>

        {/* Hero Section with modern solar image illustration */}
        <BentoCard colSpan="col-span-12" className="relative overflow-hidden min-h-[200px]">
          {/* Gradient background simulating solar panels */}
          <div className="absolute inset-0 bg-gradient-to-br from-solar-accent via-blue-500 to-solar-brand opacity-10"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%230056b3\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            backgroundSize: '60px 60px'
          }}></div>
          
          <div className="relative z-10 text-center py-12">
            <h1 className="text-4xl font-bold text-solar-dark tracking-tight mb-4">
              Proposta de Leasing Solar
            </h1>
            <p className="text-xl text-slate-600 mb-6">
              Energia limpa e renovável para o seu negócio
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <svg className="w-5 h-5 text-solar-brand" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 11a1 1 0 112 0 1 1 0 01-2 0zm2-3a1 1 0 10-2 0v3a1 1 0 102 0V8z"/>
              </svg>
              <span>Investimento zero • Economia imediata • Patrimônio garantido</span>
            </div>
          </div>
        </BentoCard>

        {/* Client Information in organized Bento cards */}
        <BentoCard colSpan="col-span-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-solar-brand/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-bold text-solar-dark text-sm">{sanitize(cliente.nome)}</p>
          </div>
        </BentoCard>

        {budgetId && (
          <BentoCard colSpan="col-span-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Proposta</p>
              <p className="font-bold text-solar-dark text-sm">#{sanitize(budgetId)}</p>
            </div>
          </BentoCard>
        )}

        {cliente.cidade && cliente.uf && (
          <BentoCard colSpan="col-span-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Localização</p>
              <p className="font-bold text-solar-dark text-sm">{sanitize(cliente.cidade)}, {sanitize(cliente.uf)}</p>
            </div>
          </BentoCard>
        )}

        {/* Main KPIs - Large and prominent */}
        <KpiCard 
          label="Potência Instalada"
          value={formatKwp(potenciaInstaladaKwp) || '—'}
          colSpan="col-span-4"
          variant="highlight"
          className="col-span-4"
        />
        <KpiCard 
          label="Geração Mensal Estimada"
          value={formatKwhMes(geracaoMensalKwh) || '—'}
          className="col-span-4"
        />
        <KpiCard 
          label="Desconto Contratual"
          value={formatPercent(descontoContratualPct) || '—'}
          variant="accent"
          className="col-span-4"
        />
      </PrintLayout>

      {/* PAGE 2 - BENEFITS & EXECUTIVE SUMMARY */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white mb-1">Benefícios do Leasing Solar</h2>
          <p className="text-white/80 text-sm">Energia renovável com vantagens financeiras</p>
        </BentoCard>

        {/* Key benefits in visual cards */}
        <BentoCard colSpan="col-span-3">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-solar-dark mb-1">Investimento Zero</p>
            <p className="text-xs text-slate-600">Sem custo inicial de instalação</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-3">
          <div className="text-center">
            <div className="w-14 h-14 bg-solar-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-xs font-bold text-solar-dark mb-1">Economia Imediata</p>
            <p className="text-xs text-slate-600">Redução na conta desde o 1º mês</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-3">
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-solar-dark mb-1">Manutenção Inclusa</p>
            <p className="text-xs text-slate-600">Sem preocupações operacionais</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-3">
          <div className="text-center">
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-xs font-bold text-solar-dark mb-1">Ativo Garantido</p>
            <p className="text-xs text-slate-600">Usina transferida ao final</p>
          </div>
        </BentoCard>

        {/* Executive Summary */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Resumo Executivo</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Modelo:</span>
                  <span className="text-sm font-semibold text-solar-dark">Leasing Operacional</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Prazo Contratual:</span>
                  <span className="text-sm font-semibold text-solar-dark">{leasingPrazoContratualMeses} meses</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Desconto Garantido:</span>
                  <span className="text-sm font-semibold text-green-600">{formatPercent(descontoContratualPct)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Potência Sistema:</span>
                  <span className="text-sm font-semibold text-solar-dark">{formatKwp(potenciaInstaladaKwp)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Geração Mensal:</span>
                  <span className="text-sm font-semibold text-solar-dark">{formatKwhMes(geracaoMensalKwh)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Investimento Inicial:</span>
                  <span className="text-sm font-semibold text-green-600">R$ 0,00</span>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* What's included - more visual */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>O Que Está Incluso na Solução</BentoCardTitle>
          <BentoCardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Projeto Completo</p>
                  <p className="text-xs text-slate-600">Engenharia e homologação junto à distribuidora</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Equipamentos Premium</p>
                  <p className="text-xs text-slate-600">Módulos Tier 1 e inversores certificados</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Instalação Profissional</p>
                  <p className="text-xs text-slate-600">Equipe certificada com garantia de execução</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Monitoramento 24/7</p>
                  <p className="text-xs text-slate-600">Plataforma cloud com acompanhamento em tempo real</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Manutenção Total</p>
                  <p className="text-xs text-slate-600">Preventiva e corretiva durante toda a vigência</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-solar-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark mb-0.5">Transferência de Propriedade</p>
                  <p className="text-xs text-slate-600">Usina é sua ao final, sem custos adicionais</p>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 3 - TECHNICAL SPECIFICATIONS WITH ILLUSTRATIONS */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Especificações Técnicas</h2>
        </BentoCard>

        {/* Technical KPIs with icons */}
        <BentoCard colSpan="col-span-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-solar-brand to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Potência Instalada</p>
            <p className="text-3xl font-bold text-solar-dark mb-1">{formatKwp(potenciaInstaladaKwp)}</p>
            <p className="text-xs text-slate-500">Sistema fotovoltaico</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Geração Estimada</p>
            <p className="text-3xl font-bold text-solar-dark mb-1">{formatKwhMes(geracaoMensalKwh)}</p>
            <p className="text-xs text-slate-500">Média mensal</p>
          </div>
        </BentoCard>

        <BentoCard colSpan="col-span-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Área Estimada</p>
            <p className="text-3xl font-bold text-solar-dark mb-1">{formatArea(areaInstalacao)}</p>
            <p className="text-xs text-slate-500">Instalação</p>
          </div>
        </BentoCard>

        {/* Solar Modules with illustration */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Módulos Fotovoltaicos</span>
            </div>
          </BentoCardTitle>
          <BentoCardContent>
            {/* Simple module illustration */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-4 mb-3">
              <div className="grid grid-cols-3 gap-1">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="aspect-square bg-blue-900 rounded-sm opacity-80"></div>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-semibold text-solar-dark">{leasingModeloModulo || 'Jinko, Maxeon ou Similares'}</p>
                <p className="text-xs text-slate-600 mt-1">Módulos Tier 1 com 25 anos de garantia de performance</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Certificação INMETRO</span>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Inverter with illustration */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-solar-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span>Inversor Solar</span>
            </div>
          </BentoCardTitle>
          <BentoCardContent>
            {/* Simple inverter illustration */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 mb-3 relative">
              <div className="absolute top-3 right-3 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xs text-white/60 mb-1">PWR</div>
                  <div className="w-12 h-1 bg-green-400 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-semibold text-solar-dark">{leasingModeloInversor || 'Huawei, Solis ou Similares'}</p>
                <p className="text-xs text-slate-600 mt-1">Inversores string com conectividade IoT e monitoramento remoto</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Certificação INMETRO • Wi-Fi integrado</span>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* System diagram */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Como o Sistema Funciona</BentoCardTitle>
          <BentoCardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center">
                <div className="w-20 h-20 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-solar-dark">1. Sol</p>
                <p className="text-xs text-slate-600">Luz solar captada pelos módulos</p>
              </div>
              
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>

              <div className="flex-1 text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-solar-dark">2. Inversor</p>
                <p className="text-xs text-slate-600">Conversão CC para CA</p>
              </div>

              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>

              <div className="flex-1 text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-solar-dark">3. Seu Imóvel</p>
                <p className="text-xs text-slate-600">Energia limpa e economia</p>
              </div>

              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>

              <div className="flex-1 text-center">
                <div className="w-20 h-20 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-solar-dark">4. Distribuidora</p>
                <p className="text-xs text-slate-600">Créditos de energia</p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 4 - FINANCIAL ANALYSIS WITH CHARTS */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Análise Financeira</h2>
        </BentoCard>

        {/* Monthly comparison - Visual bar chart representation */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Comparativo de Custos Mensais</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-6">
              {/* Distribuidora */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Conta Distribuidora (atual)</span>
                  <span className="text-lg font-bold text-red-600">
                    {(parcelasLeasing && parcelasLeasing.length > 0) ? formatMoneyBR(parcelasLeasing[0].mensalidadeCheia) : '—'}
                  </span>
                </div>
                <div className="h-8 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-end pr-3" style={{ width: '100%' }}>
                    <span className="text-xs text-white font-semibold">100%</span>
                  </div>
                </div>
              </div>

              {/* SolarInvest */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Com SolarInvest (leasing)</span>
                  <span className="text-lg font-bold text-green-600">
                    {(parcelasLeasing && parcelasLeasing.length > 0) ? formatMoneyBR(parcelasLeasing[0].mensalidade) : '—'}
                  </span>
                </div>
                <div className="h-8 bg-green-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-end pr-3" 
                    style={{ 
                      width: `${parcelasLeasing && parcelasLeasing.length > 0 ? (parcelasLeasing[0].mensalidade / parcelasLeasing[0].mensalidadeCheia * 100) : 85}%`
                    }}
                  >
                    <span className="text-xs text-white font-semibold">
                      {parcelasLeasing && parcelasLeasing.length > 0 
                        ? `${Math.round(100 - (parcelasLeasing[0].mensalidade / parcelasLeasing[0].mensalidadeCheia * 100))}% menos`
                        : '—'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings highlight */}
              <div className="bg-solar-brand/10 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">💰 Economia Mensal Imediata</p>
                <p className="text-3xl font-bold text-solar-brand">
                  {(parcelasLeasing && parcelasLeasing.length > 0)
                    ? formatMoneyBR(parcelasLeasing[0].mensalidadeCheia - parcelasLeasing[0].mensalidade)
                    : '—'
                  }
                </p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Accumulated savings - Bar chart visualization */}
        <BentoCard colSpan="col-span-12">
          <BentoCardTitle>Economia Acumulada Projetada (anos)</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-4">
              {economiasPorAno.map(({ ano, economia }) => {
                const maxEconomia = Math.max(...economiasPorAno.map(e => e.economia))
                const barWidth = maxEconomia > 0 ? (economia / maxEconomia * 100) : 0
                
                return (
                  <div key={ano}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700">{ano} {ano === 1 ? 'ano' : 'anos'}</span>
                      <span className="text-sm font-bold text-solar-dark">{formatMoneyBR(economia)}</span>
                    </div>
                    <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-solar-brand to-yellow-500 rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Asset value projection */}
        {leasingValorDeMercadoEstimado && (
          <BentoCard colSpan="col-span-12" variant="highlight">
            <BentoCardContent>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-white text-lg font-semibold">Valor da Usina ao Final do Contrato</p>
                </div>
                <p className="text-5xl font-bold text-white mb-2">{formatMoneyBR(leasingValorDeMercadoEstimado)}</p>
                <p className="text-white/90 text-sm">🎁 Patrimônio transferido para você sem custos adicionais</p>
              </div>
            </BentoCardContent>
          </BentoCard>
        )}
      </PrintLayout>

      {/* PAGE 5 - IMPORTANT INFORMATION */}
      <PrintLayout className="break-after-page">
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Informações Importantes</h2>
        </BentoCard>

        {/* Installation requirements with icons */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Requisitos para Instalação</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark">Área sem Sombreamento</p>
                  <p className="text-xs text-slate-600">Local livre de sombras durante o dia</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark">Estrutura Adequada</p>
                  <p className="text-xs text-slate-600">Telhado ou solo com suporte estrutural</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark">Quadro Elétrico</p>
                  <p className="text-xs text-slate-600">Painel acessível para conexão</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-solar-dark">Unidade Ativa</p>
                  <p className="text-xs text-slate-600">UC regularizada na distribuidora</p>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Process and timeline */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Processo de Implementação</BentoCardTitle>
          <BentoCardContent>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-solar-brand rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                  <div className="w-0.5 h-full bg-slate-200 my-1"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-semibold text-solar-dark">Aprovação & Vistoria</p>
                  <p className="text-xs text-slate-600">Análise de crédito e vistoria técnica</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-solar-brand rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                  <div className="w-0.5 h-full bg-slate-200 my-1"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-semibold text-solar-dark">Projeto & Homologação</p>
                  <p className="text-xs text-slate-600">Engenharia e aprovação pela concessionária</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-solar-brand rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                  <div className="w-0.5 h-full bg-slate-200 my-1"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-semibold text-solar-dark">Instalação</p>
                  <p className="text-xs text-slate-600">Montagem completa do sistema solar</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-600">Ativação & Economia</p>
                  <p className="text-xs text-slate-600">Sistema operando e economia imediata</p>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Disclaimers */}
        <BentoCard colSpan="col-span-12">
          <BentoCardContent>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p><strong>Geração de Energia:</strong> Os valores de geração apresentados são estimativas baseadas na irradiação média da região. A geração real pode variar conforme condições climáticas, sombreamento, orientação e inclinação dos módulos.</p>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p><strong>Valores Financeiros:</strong> Todas as projeções de economia são baseadas no consumo histórico informado e na tarifa vigente. Reajustes tarifários e mudanças no padrão de consumo podem afetar os valores apresentados.</p>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p><strong>Validade da Proposta:</strong> Esta proposta tem validade de 30 dias a partir da emissão. A formalização está sujeita à aprovação de crédito, vistoria técnica e disponibilidade de equipamentos.</p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Call to action */}
        <BentoCard colSpan="col-span-12" variant="highlight">
          <BentoCardContent>
            <div className="text-center">
              <p className="text-white text-lg font-bold mb-2">
                🌟 Pronto para começar sua jornada solar?
              </p>
              <p className="text-white/90 text-sm">
                Entre em contato com nossa equipe para dar o próximo passo rumo à energia limpa e economia garantida
              </p>
            </div>
          </BentoCardContent>
        </BentoCard>
      </PrintLayout>

      {/* PAGE 6 - TERMS AND RESPONSIBILITIES */}
      <PrintLayout>
        <BentoCard colSpan="col-span-12" variant="dark">
          <h2 className="text-2xl font-bold text-white">Termos e Responsabilidades</h2>
        </BentoCard>

        {/* SolarInvest responsibilities */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Responsabilidades SolarInvest</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Instalação completa do sistema fotovoltaico</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Homologação junto à distribuidora de energia</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Garantia de equipamentos e instalação</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Manutenção preventiva e corretiva durante vigência</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Monitoramento remoto contínuo da geração</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-solar-brand flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Transferência da usina ao final do contrato</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Client responsibilities */}
        <BentoCard colSpan="col-span-6">
          <BentoCardTitle>Responsabilidades do Cliente</BentoCardTitle>
          <BentoCardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Pagamento pontual da mensalidade acordada</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Manter a unidade consumidora ativa e regularizada</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Permitir acesso para manutenções agendadas</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Não realizar alterações sem autorização prévia</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Comunicar problemas ou anormalidades</span>
              </li>
            </ul>
          </BentoCardContent>
        </BentoCard>

        {/* Key highlight */}
        <BentoCard colSpan="col-span-12" variant="highlight">
          <BentoCardContent>
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <p className="text-white text-xl font-bold">
                  Ao final de {leasingPrazoContratualMeses} meses, a usina solar é 100% sua
                </p>
              </div>
              <p className="text-white/90 text-sm">
                Sem custos adicionais • Sem burocracia • Patrimônio garantido
              </p>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Legal disclaimer */}
        <BentoCard colSpan="col-span-12">
          <BentoCardContent>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Esta proposta comercial tem validade de 30 dias a partir da emissão. A formalização está sujeita à aprovação de crédito, vistoria técnica e disponibilidade de equipamentos. 
              Os valores e condições finais serão estabelecidos no contrato definitivo de leasing operacional. 
              Para mais informações, consulte nossa equipe comercial.
            </p>
          </BentoCardContent>
        </BentoCard>

        {/* Footer with logo */}
        <div className="col-span-12 flex justify-center items-center mt-4">
          <img 
            src="/brand/logo.svg" 
            alt="SolarInvest" 
            className="h-6 w-auto opacity-40"
          />
        </div>
      </PrintLayout>
    </div>
  )
}
