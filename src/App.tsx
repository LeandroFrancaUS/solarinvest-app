import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from 'recharts'

import {
  selectCreditoMensal,
  selectInflacaoMensal,
  selectBuyoutLinhas,
  selectKcAjustado,
  selectMensalidades,
  selectTarifaDescontada,
  selectMensalidadesPorAno,
  SimulationState,
  BuyoutLinha,
} from './selectors'
import { EntradaModo, tarifaDescontada as tarifaDescontadaCalc, tarifaProjetadaCheia } from './utils/calcs'
import { getIrradiacaoPorEstado, hasEstadoMinimo, IRRADIACAO_FALLBACK } from './utils/irradiacao'
import { getMesReajusteFromANEEL } from './utils/reajusteAneel'
import { getTarifaCheia } from './utils/tarifaAneel'
import { getDistribuidorasFallback, loadDistribuidorasAneel } from './utils/distribuidorasAneel'
import { selectNumberInputOnFocus } from './utils/focusHandlers'

const currency = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$\u00a00,00'

const tarifaCurrency = (v: number) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : 'R$\u00a00,000'

const formatAxis = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`
  return currency(v)
}

/**
 * Quando estivermos hospedados no domínio oficial da SolarInvest, precisamos conversar
 * com o backend dedicado ao CRM. Esta constante prepara a base da URL já pensando
 * nessa integração, mas mantém um endpoint local durante o desenvolvimento para que
 * nada quebre quando executarmos em localhost.
 */
const CRM_BACKEND_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'solarinvest.info'
    ? 'https://solarinvest.info/api/crm'
    : 'http://localhost:3001/api/crm'

const DISTRIBUIDORAS_FALLBACK = getDistribuidorasFallback()
const UF_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

const ESTADOS_BRASILEIROS = Object.entries(UF_LABELS)
  .map(([sigla, nome]) => ({ sigla, nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

const formatCpfCnpj = (valor: string) => {
  const numeros = valor.replace(/\D+/g, '')
  if (!numeros) {
    return ''
  }

  if (numeros.length <= 11) {
    const digits = numeros.slice(0, 11)
    const parte1 = digits.slice(0, 3)
    const parte2 = digits.slice(3, 6)
    const parte3 = digits.slice(6, 9)
    const parte4 = digits.slice(9, 11)

    return [
      parte1,
      parte2 ? `.${parte2}` : '',
      parte3 ? `.${parte3}` : '',
      parte4 ? `-${parte4}` : '',
    ]
      .join('')
      .replace(/\.$/, '')
      .replace(/-$/, '')
  }

  const digits = numeros.slice(0, 14)
  const parte1 = digits.slice(0, 2)
  const parte2 = digits.slice(2, 5)
  const parte3 = digits.slice(5, 8)
  const parte4 = digits.slice(8, 12)
  const parte5 = digits.slice(12, 14)

  return [
    parte1,
    parte2 ? `.${parte2}` : '',
    parte3 ? `.${parte3}` : '',
    parte4 ? `/${parte4}` : '',
    parte5 ? `-${parte5}` : '',
  ]
    .join('')
    .replace(/\.$/, '')
    .replace(/\/$/, '')
    .replace(/-$/, '')
}

const emailValido = (valor: string) => {
  if (!valor) {
    return true
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(valor)
}

type IbgeMunicipio = {
  nome?: string
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string
      }
    }
  }
}

type TabKey = 'leasing' | 'cliente' | 'vendas' | 'financiamento'

type SettingsTabKey = 'mercado' | 'leasing' | 'financiamento' | 'buyout' | 'outros'

type TipoInstalacao = 'TELHADO' | 'SOLO'

const SETTINGS_TABS: { id: SettingsTabKey; label: string }[] = [
  { id: 'mercado', label: 'Mercado & Energia' },
  { id: 'leasing', label: 'Leasing Parâmetros' },
  { id: 'financiamento', label: 'Financiamento Parâmetros' },
  { id: 'buyout', label: 'Buyout Parâmetros' },
  { id: 'outros', label: 'Outros' },
]

type SeguroModo = 'A' | 'B'

type EntradaModoLabel = 'Crédito mensal' | 'Reduz piso contratado'

/**
 * Estrutura base para os blocos de conteúdo da página de CRM. A ideia aqui é manter
 * todos os textos centralizados, facilitando futuras integrações com CMS ou API.
 */
type CrmContentBlock = {
  id: string
  title: string
  description: string
  points: string[]
  automationHighlights?: string[]
}

/**
 * Seções principais do CRM conforme solicitado, com o máximo de comentários para
 * facilitar a manutenção e futuras evoluções do produto digital.
 */
const CRM_FEATURE_SECTIONS: CrmContentBlock[] = [
  {
    id: 'captacao-qualificacao',
    title: '1. Captação e qualificação',
    description:
      'Centralize todos os leads em um único funil inteligente e registre dados ricos para personalizar a jornada.',
    points: [
      'Integração direta com o site e anúncios – quando alguém pede orçamento, o lead entra automaticamente no funil.',
      'Registro automático da origem do lead (Instagram, WhatsApp, indicação, eventos, feiras e muito mais).',
      'Campos personalizados para cidade, tipo de imóvel, consumo mensal (kWh) e interesse em sistemas off-grid ou on-grid.',
    ],
    automationHighlights: [
      'Leads captados disparam tags e segmentações automáticas.',
      'Criação automática de registros de projeto vinculados ao lead desde o primeiro contato.',
    ],
  },
  {
    id: 'prospeccao-proposta',
    title: '2. Prospecção e proposta',
    description: 'Transforme oportunidades em contratos com um funil visual e rico em contexto.',
    points: [
      'Funil visual de vendas com etapas: Novo lead → Proposta enviada → Negociação → Visita técnica → Contrato assinado.',
      'Geração automática de propostas em PDF com o branding SolarInvest e dados personalizados do cliente.',
      'Histórico completo de conversas e anexos – documentos, fotos do telhado, planilhas e tudo mais em um só lugar.',
    ],
    automationHighlights: [
      'Follow-up automático após 48h sem resposta.',
      'Mudanças de etapa geram tarefas automáticas no módulo de Contrato.',
    ],
  },
  {
    id: 'contrato-implantacao',
    title: '3. Contrato e implantação',
    description: 'Execução rápida e rastreável com checklist técnico e comunicação integrada.',
    points: [
      'Integração com assinatura digital e controle de status de instalação em tempo real.',
      'Notificações automáticas para o cliente (ex: “sua usina está em fase de vistoria”).',
      'Upload facilitado de ART, notas fiscais, laudos técnicos e demais documentos obrigatórios.',
    ],
    automationHighlights: [
      'Checklist técnico atualizado automaticamente conforme o contrato é assinado.',
      'Ao concluir a instalação, o status passa para “Usina ativa” sem intervenção manual.',
    ],
  },
  {
    id: 'instalacao',
    title: '4. Instalação',
    description: 'O módulo técnico assume o controle e mantém todo o time sincronizado.',
    points: [
      'Gestão de equipe, materiais, cronograma e fotos de execução vinculadas ao mesmo registro de cliente.',
      'Visão em tempo real do status (em andamento, concluída, aguardando homologação).',
      'Toda a operação técnica fica centralizada e auditável.',
    ],
    automationHighlights: [
      'Atualizações técnicas alimentam dashboards gerenciais instantaneamente.',
    ],
  },
  {
    id: 'pos-venda',
    title: '5. Pós-venda e manutenção',
    description: 'Mantenha o cliente engajado e reduza custos operacionais com monitoramento ativo.',
    points: [
      'Agenda de manutenções preventivas com alertas automáticos.',
      'Relatórios de geração (kWh) com integração via API do inversor e alertas de falhas.',
      'Registro de chamados, suporte técnico e histórico completo da usina.',
    ],
    automationHighlights: [
      'Detecção de anomalias gera tickets de suporte automaticamente.',
    ],
  },
  {
    id: 'financeiro-basico',
    title: '6. Financeiro básico',
    description: 'Tudo o que você precisa para organizar recebimentos com segurança.',
    points: [
      'Controle de recebimentos de contratos de leasing em um só painel.',
      'Integração nativa com boletos e Pix para acelerar conciliação.',
      'Dashboards de ROI e margem por usina com atualização automática.',
    ],
  },
  {
    id: 'financeiro-avancado',
    title: '7. Financeiro avançado',
    description: 'Camadas financeiras robustas para lidar com múltiplos modelos de negócio.',
    points: [
      'Contratos de leasing vinculados à cobrança mensal com geração automática de boletos.',
      'Monitoramento de status de pagamento e indicadores de inadimplência.',
      'Visão consolidada de ROI, fluxo de caixa e rentabilidade por projeto.',
    ],
  },
]

/**
 * Blueprint detalhado do CRM conforme solicitado – este conteúdo aprofunda cada pilar
 * operacional e ajuda o time a visualizar automações e integrações futuras.
 */
const CRM_BLUEPRINT_BLOCKS: CrmContentBlock[] = [
  {
    id: 'blueprint-captacao',
    title: 'Blueprint: Captação e Qualificação',
    description:
      'Objetivo: centralizar leads, classificar interesses automaticamente e iniciar projetos com dados completos.',
    points: [
      'Campos principais: nome, telefone, cidade, tipo de imóvel, consumo (kWh/mês) e origem do lead.',
      'Automações: captura automática de leads (site, Instagram Ads, WhatsApp) e classificação por interesse.',
      'Alertas para a equipe quando a proposta é aberta ou respondida pelo lead.',
      'Criação automática de registro de projeto vinculado ao lead, com tags como on-grid ou off-grid.',
    ],
  },
  {
    id: 'blueprint-propostas',
    title: 'Blueprint: Propostas e Negociação',
    description:
      'Objetivo: acompanhar o ciclo de venda com precisão, do primeiro contato até a assinatura.',
    points: [
      'Etapas do funil: Novo Lead → Proposta Enviada → Em Negociação → Visita Técnica → Aguardando Contrato → Fechado.',
      'Automações: geração de proposta em PDF, envio automático e notificações internas para follow-up.',
      'Cálculo automático de ROI e custo estimado com base no consumo informado.',
      'Registro de histórico completo (mensagens, visitas, alterações de valores) anexado ao projeto.',
    ],
  },
  {
    id: 'blueprint-contrato',
    title: 'Blueprint: Contrato e Implantação',
    description:
      'Objetivo: garantir execução rastreável com checklist técnico conectado ao CRM.',
    points: [
      'Integração com assinatura eletrônica, checklist de vistoria e homologação totalmente digital.',
      'Uploads de documentos essenciais (ART, notas fiscais, laudos) anexados ao mesmo ID do projeto.',
      'Alertas automáticos para o time técnico quando o contrato é assinado.',
      'Transformação do projeto comercial em projeto ativo com cronograma técnico e status “Instalação em andamento”.',
    ],
  },
  {
    id: 'blueprint-pos-venda',
    title: 'Blueprint: Pós-venda e Monitoramento',
    description:
      'Objetivo: manter clientes engajados, monitorar geração e abrir tickets preventivamente.',
    points: [
      'Histórico da usina com dados de equipamentos, datas de vistoria e checklist de manutenção.',
      'Integração com API do inversor para puxar geração mensal automaticamente.',
      'Alertas de anomalia e abertura automática de ticket em caso de queda de geração.',
      'Relatórios automáticos alimentam painel de desempenho e agenda de manutenção preventiva.',
    ],
  },
  {
    id: 'blueprint-financeiro',
    title: 'Blueprint: Financeiro Integrado',
    description:
      'Objetivo: consolidar contratos, fluxos de caixa e indicadores de performance financeira.',
    points: [
      'Controle de parcelas, reajustes e vencimentos com emissão automática de boletos/Pix.',
      'Dashboards de ROI, margem de lucro, adimplência e receita mensal por usina.',
      'Relatórios semanais automáticos enviados aos gestores com metas por vendedor.',
      'Alertas de gargalos (ex: muitos projetos em “aguardando visita técnica”) para ações imediatas.',
    ],
  },
  {
    id: 'blueprint-inteligencia',
    title: 'Blueprint: Inteligência e Relatórios',
    description:
      'Objetivo: visão gerencial de ponta a ponta, da conversão comercial ao retorno financeiro.',
    points: [
      'Indicadores de taxa de conversão, tempo médio de fechamento e lucro líquido por projeto.',
      'Mapa de geração (kWh) por região com consolidação de dados técnicos e financeiros.',
      'Relatórios semanais automáticos e alertas de performance por etapa do funil.',
    ],
  },
]

/**
 * Estrutura adicional para destacar as camadas financeiras avançadas solicitadas,
 * diferenciando leasing de venda direta e já indicando as métricas essenciais.
 */
const CRM_FINANCIAL_LAYERS: CrmContentBlock[] = [
  {
    id: 'financeiro-modelos',
    title: 'Modelos distintos: Leasing x Venda Direta',
    description:
      'Cada projeto traz o campo “tipo de operação” para separar fluxos de receita recorrente e pontual.',
    points: [
      'Leasing gera parcelas mensais com vencimentos, reajustes e status (em aberto, pago, atrasado).',
      'Venda direta registra entrada + parcelas únicas ou pagamento à vista.',
      'Relatórios acompanham receita recorrente (leasing) e receita pontual (vendas diretas) em paralelo.',
    ],
  },
  {
    id: 'financeiro-caixa',
    title: 'Controle de caixa real',
    description:
      'Fluxo de entrada e saída totalmente categorizado para uma visão fiel do caixa.',
    points: [
      'Lançamentos com data, categoria (Receita, Custo Fixo, Custo Variável, Investimento) e origem.',
      'Formas de pagamento mapeadas (Pix, boleto, cartão, transferência) para conciliação precisa.',
      'Indicadores exibem caixa diário/mensal, saldo acumulado e entradas vs. saídas.',
    ],
  },
  {
    id: 'financeiro-custos',
    title: 'Gestão de custos e margens',
    description:
      'Todos os custos ficam vinculados ao mesmo ID do projeto para cálculos automáticos.',
    points: [
      'Cadastro de custos de equipamentos, mão de obra, deslocamento, taxas e seguros.',
      'Cálculo de margem bruta, margem líquida, ROI e payback por projeto/mês.',
      'Dashboards permitem enxergar rentabilidade por usina em tempo real.',
    ],
  },
  {
    id: 'financeiro-dashboards',
    title: 'Dashboards e previsões',
    description:
      'Visualize projeções de leasing, indicadores de inadimplência e desempenho consolidado.',
    points: [
      'Gráfico de caixa acumulado mês a mês e projeção de entradas futuras.',
      'Indicadores de inadimplência com alertas automáticos.',
      'Painel centralizado de receitas, despesas e saldo consolidado.',
    ],
  },
]

/**
 * A partir deste ponto descrevemos estruturas de dados reais do CRM.
 * Mesmo sem um backend ativo em todos os ambientes, precisamos manter
 * um modelo coerente com o que será persistido futuramente. Assim,
 * conseguimos trabalhar com um "mini backend" local e manter a
 * experiência íntegra tanto em desenvolvimento quanto em produção.
 */
const CRM_LOCAL_STORAGE_KEY = 'solarinvest-crm-dataset-v1'

const CRM_PIPELINE_STAGES = [
  {
    id: 'novo-lead',
    label: 'Novo lead',
    description: 'Contato recém captado via site, anúncios ou indicação.',
  },
  {
    id: 'proposta-enviada',
    label: 'Proposta enviada',
    description: 'Lead recebeu proposta personalizada e aguarda retorno.',
  },
  {
    id: 'negociacao',
    label: 'Em negociação',
    description: 'Conversas ativas, ajustes comerciais e follow-ups em andamento.',
  },
  {
    id: 'visita-tecnica',
    label: 'Visita técnica',
    description: 'Equipe técnica agenda ou executa vistoria no local.',
  },
  {
    id: 'aguardando-contrato',
    label: 'Aguardando contrato',
    description: 'Contrato enviado para assinatura digital e validações finais.',
  },
  {
    id: 'fechado',
    label: 'Fechado',
    description: 'Projeto com contrato assinado e financeiro já configurado.',
  },
] as const

type CrmStageId = (typeof CRM_PIPELINE_STAGES)[number]['id']

type CrmLeadInterest = 'ON_GRID' | 'OFF_GRID' | 'CONDIMINIO' | 'COMERCIAL'

type CrmOperacao = 'LEASING' | 'VENDA_DIRETA'

type CrmLeadRecord = {
  id: string
  nome: string
  telefone: string
  email?: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: number
  origemLead: string
  interesse: CrmLeadInterest
  tipoOperacao: CrmOperacao
  valorEstimado: number
  etapa: CrmStageId
  ultimoContatoIso: string
  criadoEmIso: string
  notas?: string
}

type CrmTimelineEntry = {
  id: string
  leadId: string
  mensagem: string
  tipo: 'status' | 'anotacao' | 'financeiro'
  criadoEmIso: string
}

type CrmDataset = {
  leads: CrmLeadRecord[]
  timeline: CrmTimelineEntry[]
}

type CrmLeadFormState = {
  nome: string
  telefone: string
  email: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: string
  origemLead: string
  interesse: CrmLeadInterest
  tipoOperacao: CrmOperacao
  valorEstimado: string
  notas: string
}

const CRM_STAGE_INDEX: Record<CrmStageId, number> = CRM_PIPELINE_STAGES.reduce(
  (acc, stage, index) => {
    acc[stage.id] = index
    return acc
  },
  {} as Record<CrmStageId, number>,
)

const CRM_EMPTY_LEAD_FORM: CrmLeadFormState = {
  nome: '',
  telefone: '',
  email: '',
  cidade: '',
  tipoImovel: '',
  consumoKwhMes: '',
  origemLead: '',
  interesse: 'ON_GRID',
  tipoOperacao: 'LEASING',
  valorEstimado: '',
  notas: '',
}

const gerarIdCrm = (prefixo: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefixo}-${crypto.randomUUID()}`
  }
  const random = Math.floor(Math.random() * 1_000_000)
  return `${prefixo}-${Date.now()}-${random.toString().padStart(6, '0')}`
}

const criarDatasetCrmPadrao = (): CrmDataset => {
  const agoraIso = new Date().toISOString()
  const leads: CrmLeadRecord[] = [
    {
      id: gerarIdCrm('lead'),
      nome: 'Mariana Lopes',
      telefone: '(62) 99888-1122',
      email: 'mariana.lopes@email.com',
      cidade: 'Anápolis',
      tipoImovel: 'Residencial',
      consumoKwhMes: 420,
      origemLead: 'Site SolarInvest',
      interesse: 'ON_GRID',
      tipoOperacao: 'LEASING',
      valorEstimado: 2650,
      etapa: 'proposta-enviada',
      ultimoContatoIso: agoraIso,
      criadoEmIso: agoraIso,
      notas: 'Lead respondeu formulário completo e aguarda simulação detalhada.',
    },
    {
      id: gerarIdCrm('lead'),
      nome: 'Condomínio Boa Vista',
      telefone: '(62) 99345-7788',
      cidade: 'Goiânia',
      tipoImovel: 'Condomínio',
      consumoKwhMes: 12800,
      origemLead: 'Feira de energia 2024',
      interesse: 'CONDIMINIO',
      tipoOperacao: 'LEASING',
      valorEstimado: 18800,
      etapa: 'visita-tecnica',
      ultimoContatoIso: agoraIso,
      criadoEmIso: agoraIso,
      notas: 'Necessário avaliar possibilidade de expansão para estacionamento solar.',
    },
    {
      id: gerarIdCrm('lead'),
      nome: 'Mercado Aurora',
      telefone: '(62) 99777-5544',
      cidade: 'Senador Canedo',
      tipoImovel: 'Comercial',
      consumoKwhMes: 3800,
      origemLead: 'Instagram Ads',
      interesse: 'COMERCIAL',
      tipoOperacao: 'VENDA_DIRETA',
      valorEstimado: 142000,
      etapa: 'negociacao',
      ultimoContatoIso: agoraIso,
      criadoEmIso: agoraIso,
      notas: 'Cliente pediu revisão de payback considerando financiamento misto.',
    },
    {
      id: gerarIdCrm('lead'),
      nome: 'Fazenda Mirante',
      telefone: '(62) 99123-6677',
      cidade: 'Rio Verde',
      tipoImovel: 'Rural',
      consumoKwhMes: 6800,
      origemLead: 'Indicação',
      interesse: 'OFF_GRID',
      tipoOperacao: 'LEASING',
      valorEstimado: 9800,
      etapa: 'aguardando-contrato',
      ultimoContatoIso: agoraIso,
      criadoEmIso: agoraIso,
      notas: 'Equipe técnica já aprovou projeto, aguardando assinatura.',
    },
  ]

  const timeline: CrmTimelineEntry[] = leads.map((lead) => ({
    id: gerarIdCrm('evento'),
    leadId: lead.id,
    mensagem: `Lead "${lead.nome}" criado automaticamente no funil em ${lead.etapa}.`,
    tipo: 'status',
    criadoEmIso: lead.criadoEmIso,
  }))

  return { leads, timeline }
}

const carregarDatasetCrmLocal = (): CrmDataset => {
  if (typeof window === 'undefined') {
    return criarDatasetCrmPadrao()
  }

  try {
    const armazenado = window.localStorage.getItem(CRM_LOCAL_STORAGE_KEY)
    if (!armazenado) {
      const datasetInicial = criarDatasetCrmPadrao()
      window.localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(datasetInicial))
      return datasetInicial
    }

    const parsed = JSON.parse(armazenado) as Partial<CrmDataset>
    if (!parsed || !Array.isArray(parsed.leads) || !Array.isArray(parsed.timeline)) {
      throw new Error('Dataset do CRM inválido no storage local.')
    }

    return {
      leads: parsed.leads as CrmLeadRecord[],
      timeline: parsed.timeline as CrmTimelineEntry[],
    }
  } catch (error) {
    console.warn('Falha ao carregar dataset local do CRM, regenerando padrão.', error)
    const datasetFallback = criarDatasetCrmPadrao()
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(datasetFallback))
      } catch (storageError) {
        console.warn('Não foi possível persistir o dataset padrão do CRM.', storageError)
      }
    }
    return datasetFallback
  }
}

const normalizarCrmDatasetRemoto = (payload: unknown): CrmDataset | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const possivelDataset = payload as Partial<{ dataset: Partial<CrmDataset>; leads: CrmLeadRecord[]; timeline: CrmTimelineEntry[] }>

  if (possivelDataset.dataset && typeof possivelDataset.dataset === 'object') {
    const { leads, timeline } = possivelDataset.dataset as Partial<CrmDataset>
    if (Array.isArray(leads) && Array.isArray(timeline)) {
      return { leads: leads as CrmLeadRecord[], timeline: timeline as CrmTimelineEntry[] }
    }
  }

  if (Array.isArray(possivelDataset.leads) && Array.isArray(possivelDataset.timeline)) {
    return { leads: possivelDataset.leads as CrmLeadRecord[], timeline: possivelDataset.timeline as CrmTimelineEntry[] }
  }

  return null
}

const diasDesdeDataIso = (iso: string) => {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return Infinity
  }

  const diffMs = Date.now() - parsed.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

const formatarDataCurta = (iso: string) => {
  try {
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) {
      return '—'
    }
    return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch (error) {
    console.warn('Não foi possível formatar data ISO do CRM.', error)
    return '—'
  }
}

type ClienteDados = {
  nome: string
  documento: string
  email: string
  telefone: string
  distribuidora: string
  uc: string
  endereco: string
  cidade: string
  uf: string
}

type ClienteRegistro = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: ClienteDados
}

type NotificacaoTipo = 'success' | 'info' | 'error'

type Notificacao = {
  id: number
  mensagem: string
  tipo: NotificacaoTipo
}

const iconeNotificacaoPorTipo: Record<NotificacaoTipo, string> = {
  success: '✔',
  info: 'ℹ',
  error: '⚠',
}

type BuyoutRow = {
  mes: number
  tarifa: number
  prestacaoEfetiva: number
  prestacaoAcum: number
  cashback: number
  valorResidual: number | null
}

type BuyoutResumo = {
  vm0: number
  cashbackPct: number
  depreciacaoPct: number
  inadimplenciaPct: number
  tributosPct: number
  infEnergia: number
  ipca: number
  custosFixos: number
  opex: number
  seguro: number
  duracao: number
}

type PrintableProps = {
  cliente: ClienteDados
  anos: number[]
  leasingROI: number[]
  financiamentoFluxo: number[]
  financiamentoROI: number[]
  mostrarFinanciamento: boolean
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo
  capex: number
  geracaoMensalKwh: number
  potenciaPlaca: number
  numeroPlacas: number
  potenciaInstaladaKwp: number
  tipoInstalacao: TipoInstalacao
  areaInstalacao: number
  descontoContratualPct: number
  parcelasLeasing: MensalidadeRow[]
}

type MensalidadeRow = {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
  mensalidadeCheia: number
  mensalidade: number
  totalAcumulado: number
}

type OrcamentoSalvo = {
  id: string
  criadoEm: string
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  clienteDocumento?: string
  clienteUc?: string
  dados: PrintableProps
}

const CAMPOS_CLIENTE_OBRIGATORIOS: { key: keyof ClienteDados; label: string }[] = [
  { key: 'nome', label: 'Nome do cliente' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'Estado' },
]

const CLIENTES_STORAGE_KEY = 'solarinvest-clientes'
const BUDGETS_STORAGE_KEY = 'solarinvest-orcamentos'
const BUDGET_ID_PREFIX = 'SLRINVST-'
const BUDGET_ID_SUFFIX_LENGTH = 8
const BUDGET_ID_MAX_ATTEMPTS = 1000

const CLIENTE_INICIAL: ClienteDados = {
  nome: '',
  documento: '',
  email: '',
  telefone: '',
  distribuidora: '',
  uc: '',
  endereco: '',
  cidade: 'Anápolis',
  uf: 'GO',
}

const generateBudgetId = (existingIds: Set<string> = new Set()) => {
  let attempts = 0

  while (attempts < BUDGET_ID_MAX_ATTEMPTS) {
    attempts += 1
    const randomNumber = Math.floor(Math.random() * 10 ** BUDGET_ID_SUFFIX_LENGTH)
    const suffix = randomNumber.toString().padStart(BUDGET_ID_SUFFIX_LENGTH, '0')
    const candidate = `${BUDGET_ID_PREFIX}${suffix}`

    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um código de orçamento único.')
}

const clonePrintableData = (dados: PrintableProps): PrintableProps => ({
  ...dados,
  cliente: { ...dados.cliente },
  anos: [...dados.anos],
  leasingROI: [...dados.leasingROI],
  financiamentoFluxo: [...dados.financiamentoFluxo],
  financiamentoROI: [...dados.financiamentoROI],
  tabelaBuyout: dados.tabelaBuyout.map((row) => ({ ...row })),
  buyoutResumo: { ...dados.buyoutResumo },
  parcelasLeasing: dados.parcelasLeasing.map((row) => ({ ...row })),
})

const cloneClienteDados = (dados: ClienteDados): ClienteDados => ({ ...dados })

const generateClienteId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const random = Math.floor(Math.random() * 1_000_000)
  return `cliente-${Date.now()}-${random.toString().padStart(6, '0')}`
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const normalizeNumbers = (value: string) => value.replace(/\D+/g, '')

const formatBudgetDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <span className="info-tooltip" ref={containerRef}>
      <button
        type="button"
        className={`info-icon${open ? ' open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Mostrar explicação"
        aria-haspopup="true"
        aria-controls={open ? tooltipId : undefined}
        ref={buttonRef}
        onBlur={(event) => {
          const nextFocus = event.relatedTarget as Node | null
          if (!nextFocus || !containerRef.current?.contains(nextFocus)) {
            setOpen(false)
          }
        }}
      >
        ?
      </button>
      {open ? (
        <span role="tooltip" id={tooltipId} className="info-bubble">
          {text}
        </span>
      ) : null}
    </span>
  )
}

type ClientesModalProps = {
  registros: ClienteRegistro[]
  onClose: () => void
  onEditar: (registro: ClienteRegistro) => void
  onExcluir: (registro: ClienteRegistro) => void
}

const ClientesModal: React.FC<ClientesModalProps> = ({ registros, onClose, onEditar, onExcluir }) => {
  const modalTitleId = useId()

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Clientes salvos</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar listagem de clientes">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <section className="budget-search-panel clients-panel">
            <div className="budget-search-header">
              <h4>Gestão de clientes</h4>
              <p>Clientes armazenados localmente neste dispositivo.</p>
            </div>
            {registros.length === 0 ? (
              <p className="budget-search-empty">Nenhum cliente foi salvo até o momento.</p>
            ) : (
              <div className="budget-search-table clients-table">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Documento</th>
                        <th>Cidade/UF</th>
                        <th>Criado em</th>
                        <th>Atualizado em</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((registro) => {
                        const { dados } = registro
                        const cidade = dados.cidade?.trim()
                        const uf = dados.uf?.trim()
                        return (
                          <tr key={registro.id}>
                            <td>
                              <button
                                type="button"
                                className="clients-table-client clients-table-load"
                                onClick={() => onEditar(registro)}
                                title="Carregar dados do cliente"
                                aria-label="Carregar dados do cliente"
                              >
                                <strong>{dados.nome || '—'}</strong>
                                <span>{dados.email || 'E-mail não informado'}</span>
                              </button>
                            </td>
                            <td>{dados.documento || '—'}</td>
                            <td>
                              {cidade || uf ? (
                                <span>{`${cidade || '—'}${uf ? `/${uf}` : ''}`}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>{formatBudgetDate(registro.criadoEm)}</td>
                            <td>{formatBudgetDate(registro.atualizadoEm)}</td>
                            <td>
                              <div className="clients-table-actions">
                                <button
                                  type="button"
                                  className="clients-table-action"
                                  onClick={() => onEditar(registro)}
                                  aria-label="Carregar dados do cliente"
                                  title="Carregar dados do cliente"
                                >
                                  <span aria-hidden="true">📁</span>
                                </button>
                                <button
                                  type="button"
                                  className="clients-table-action danger"
                                  onClick={() => onExcluir(registro)}
                                  aria-label="Excluir cliente salvo"
                                  title="Excluir cliente salvo"
                                >
                                  <span aria-hidden="true">🗑</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }> = ({
  label,
  children,
  hint,
}) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint ? <small>{hint}</small> : null}
  </div>
)

const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProps>(function PrintableProposal(
  {
    cliente,
    anos,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
    tabelaBuyout,
    buyoutResumo,
    capex,
    geracaoMensalKwh,
    potenciaPlaca,
    numeroPlacas,
    potenciaInstaladaKwp,
    tipoInstalacao,
    areaInstalacao,
    descontoContratualPct,
    parcelasLeasing,
  },
  ref,
) {
  const duracaoContrato = Math.max(0, Math.floor(buyoutResumo.duracao || 0))
  const mesAceiteFinal = duracaoContrato + 1
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    Number.isFinite(value) ? value.toLocaleString('pt-BR', options) : '—'
  const valorMercadoValido = typeof buyoutResumo.vm0 === 'number' && Number.isFinite(buyoutResumo.vm0)
  const valorMercadoTexto = valorMercadoValido ? currency(buyoutResumo.vm0) : '—'
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const duracaoContratualTexto = duracaoContratualValida ? `${buyoutResumo.duracao} meses` : '—'
  const tipoInstalacaoDescricao =
    tipoInstalacao === 'SOLO' ? 'Solo' : tipoInstalacao === 'TELHADO' ? 'Telhado' : '—'
  const areaInstalacaoValida = Number.isFinite(areaInstalacao) && areaInstalacao > 0
  const areaInstalacaoTexto = areaInstalacaoValida
    ? areaInstalacao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '—'
  const chartDataPrintable = useMemo(
    () =>
      anos.map((ano) => ({
        ano,
        Leasing: leasingROI[ano - 1] ?? 0,
        Financiamento: financiamentoROI[ano - 1] ?? 0,
      })),
    [anos, financiamentoROI, leasingROI],
  )
  const beneficioAno30Printable = useMemo(
    () => chartDataPrintable.find((row) => row.ano === 30) ?? null,
    [chartDataPrintable],
  )
  return (
    <div ref={ref} className="print-layout">
      <header className="print-header">
        <div className="print-logo">
          <img src="/logo.svg" alt="SolarInvest" />
        </div>
        <div className="print-client">
          <h1>SolarInvest - Proposta de Leasing</h1>
          <p><strong>Cliente:</strong> {cliente.nome || '—'}</p>
          <p><strong>Documento:</strong> {cliente.documento || '—'}</p>
          <p>
            <strong>E-mail:</strong> {cliente.email || '—'} • <strong>Telefone:</strong> {cliente.telefone || '—'}
          </p>
          <p>
            <strong>UC:</strong> {cliente.uc || '—'} • <strong>Distribuidora:</strong> {cliente.distribuidora || '—'}
          </p>
          <p>
            <strong>Endereço:</strong> {cliente.endereco || '—'} — {cliente.cidade || '—'} / {cliente.uf || '—'}
          </p>
        </div>
      </header>

      <section className="print-section">
        <h2>Resumo técnico e financeiro</h2>
        <div className="print-summary">
          <p>
            <strong>Investimento da SolarInvest:</strong> {currency(capex)}
          </p>
          <p>
            <strong>Geração estimada (kWh/mês):</strong> {formatNumber(geracaoMensalKwh)}
          </p>
          <p>
            <strong>Potência da placa (Wp):</strong> {formatNumber(potenciaPlaca, { maximumFractionDigits: 0 })}
          </p>
          <p>
            <strong>Nº de placas:</strong> {formatNumber(numeroPlacas, { maximumFractionDigits: 0 })}
          </p>
          <p>
            <strong>Potência instalada (kWp):</strong>{' '}
            {formatNumber(potenciaInstaladaKwp, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p>
            <strong>Tipo de instalação:</strong> {tipoInstalacaoDescricao}
          </p>
          <p>
            <strong>Área utilizada (m²):</strong> {areaInstalacaoTexto}
          </p>
        </div>
        <div className={`print-grid ${mostrarFinanciamento ? 'two' : 'one'}`}>
          <div>
            <h3>Mensalidade projetada</h3>
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Tarifa projetada (R$/kWh)</th>
                  <th>Tarifa c/ desconto (R$/kWh)</th>
                  <th>Mensalidade cheia</th>
                  <th>Mensalidade com leasing</th>
                </tr>
              </thead>
              <tbody>
                {parcelasLeasing.length > 0 ? (
                  parcelasLeasing.map((row) => (
                    <tr key={`leasing-${row.mes}`}>
                      <td>{row.mes}</td>
                      <td>{tarifaCurrency(row.tarifaCheia)}</td>
                      <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                      <td>{currency(row.mensalidadeCheia)}</td>
                      <td>{currency(row.mensalidade)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="muted">
                      Defina um prazo contratual para gerar a projeção das parcelas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {mostrarFinanciamento ? (
            <div>
              <h3>Financiamento</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Fluxo anual</th>
                    <th>Beneficio acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {anos.map((ano) => (
                    <tr key={`fin-${ano}`}>
                      <td>{ano}</td>
                      <td>{currency(financiamentoFluxo[ano - 1] ?? 0)}</td>
                      <td>{currency(financiamentoROI[ano - 1] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="print-section">
        <div className="print-notes">
          <p><strong>Informações adicionais:</strong></p>
          <ul>
            <li>
              Valor de mercado estimado conforme parâmetros atuais do setor: {valorMercadoTexto}
            </li>
            <li>
              Desconto contratual aplicado:{' '}
              {formatNumber(descontoContratualPct, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}%
            </li>
            <li>
              Prazo de vigência contratual conforme especificado em proposta individual: {duracaoContratualTexto}
            </li>
            <li>Tabela de compra antecipada da usina disponível mediante solicitação.</li>
            <li>Todos os equipamentos utilizados possuem certificação INMETRO.</li>
            <li>
              Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer alterações no contrato definitivo.
            </li>
          </ul>
        </div>
        <div className="print-chart-section">
          <div className="chart print-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartDataPrintable}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="ano" stroke="#9CA3AF" label={{ value: 'Anos', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" tickFormatter={formatAxis} />
                <Tooltip formatter={(value: number) => currency(Number(value))} contentStyle={{ background: '#0b1220', border: '1px solid #1f2b40' }} />
                <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16 }} />
                <ReferenceLine y={0} stroke="#475569" />
                <Line type="monotone" dataKey="Leasing" stroke={chartColors.Leasing} strokeWidth={2} dot />
                {mostrarFinanciamento ? (
                  <Line type="monotone" dataKey="Financiamento" stroke={chartColors.Financiamento} strokeWidth={2} dot />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {beneficioAno30Printable ? (
            <p className="chart-explainer">
              Beneficio acumulado em 30 anos:
              <strong style={{ color: chartColors.Leasing }}> {currency(beneficioAno30Printable.Leasing)}</strong>
              {mostrarFinanciamento ? (
                <>
                  {' • '}Financiamento:{' '}
                  <strong style={{ color: chartColors.Financiamento }}>{currency(beneficioAno30Printable.Financiamento)}</strong>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <p className="print-footer">
          Após o final do contrato a usina passa a render 100% de economia frente a concessionaria para o cliente
        </p>
      </section>
    </div>
  )
})

type BudgetPreviewOptions = {
  nomeCliente: string
  budgetId?: string
  actionMessage?: string
  autoPrint?: boolean
  closeAfterPrint?: boolean
}

const renderPrintableProposalToHtml = (dados: PrintableProps): Promise<string | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '1040px'
    container.style.padding = '36px 44px'
    container.style.background = '#ffffff'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    let resolved = false

    const cleanup = (root: ReturnType<typeof createRoot> | null) => {
      if (root) {
        root.unmount()
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container)
      }
    }

    const PrintableHost: React.FC = () => {
      const localRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        const timeouts: number[] = []
        let attempts = 0
        const maxAttempts = 8

        const chartIsReady = (containerEl: HTMLDivElement | null) => {
          if (!containerEl) {
            return false
          }
          const chartSvg = containerEl.querySelector('.print-chart svg')
          if (!chartSvg) {
            return false
          }
          if (chartSvg.childNodes.length === 0) {
            return false
          }
          return true
        }

        const attemptCapture = (root: ReturnType<typeof createRoot> | null) => {
          if (resolved) {
            return
          }

          const containerEl = localRef.current

          if (containerEl && chartIsReady(containerEl)) {
            resolved = true
            resolve(containerEl.outerHTML)
            cleanup(root)
            return
          }

          attempts += 1
          if (attempts >= maxAttempts) {
            resolved = true
            resolve(containerEl ? containerEl.outerHTML : null)
            cleanup(root)
            return
          }

          const timeoutId = window.setTimeout(() => attemptCapture(root), 160)
          timeouts.push(timeoutId)
        }

        const triggerResize = () => {
          window.dispatchEvent(new Event('resize'))
        }

        const resizeTimeout = window.setTimeout(triggerResize, 120)
        timeouts.push(resizeTimeout)

        const initialTimeout = window.setTimeout(() => attemptCapture(rootInstance), 220)
        timeouts.push(initialTimeout)

        return () => {
          timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
        }
      }, [])

      return <PrintableProposal ref={localRef} {...dados} />
    }

    const rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)
  })
}

const anosAnalise = 30
const DIAS_MES_PADRAO = 30
const painelOpcoes = [450, 500, 550, 600, 610, 650, 700]
const chartColors: Record<'Leasing' | 'Financiamento', string> = {
  Leasing: '#FF8C00',
  Financiamento: '#60A5FA',
}

const printStyles = `
  *{box-sizing:border-box;font-family:'Inter','Roboto',sans-serif;}
  body{margin:0;padding:36px 44px;background:#ffffff;color:#0f172a;}
  h1,h2,h3{color:#0f172a;}
  .print-layout{display:block;max-width:1040px;margin:0 auto;page-break-after:avoid;}
  .print-header{display:flex;gap:24px;align-items:center;margin-bottom:24px;break-inside:avoid;page-break-inside:avoid;}
  .print-header img{height:72px;}
  .print-client p{margin:4px 0;font-size:13px;}
  .print-section{margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;}
  .print-section h2{margin:0 0 12px;border-bottom:1px solid #cbd5f5;padding-bottom:4px;break-inside:avoid;page-break-inside:avoid;}
  table{width:100%;border-collapse:collapse;page-break-inside:auto;}
  th,td{border:1px solid #d0d7e8;padding:8px 12px;font-size:12px;text-align:left;break-inside:avoid;page-break-inside:avoid;}
  .print-summary p{font-size:12px;margin:2px 0;line-height:1.2;}
  .print-summary,.print-notes,.print-chart-section{break-inside:avoid;page-break-inside:avoid;}
  .print-grid{display:grid;gap:16px;}
  .print-grid.two{grid-template-columns:repeat(2,minmax(0,1fr));}
  .print-grid.one{grid-template-columns:repeat(1,minmax(0,1fr));}
  ul{margin:8px 0 0;padding-left:18px;}
  li{font-size:12px;margin-bottom:4px;}
  .print-chart{position:relative;padding:16px;border:1px solid #cbd5f5;border-radius:12px;background:#f8fafc;}
  .print-chart .recharts-responsive-container{width:100%;height:100%;}
  .print-chart svg{overflow:visible;}
  .print-chart .recharts-cartesian-axis-line,.print-chart .recharts-cartesian-axis-tick-line{stroke:#cbd5f5;}
  .print-chart .recharts-cartesian-axis-tick text{fill:#475569;font-size:12px;}
  .print-chart .recharts-legend-item text{fill:#1e293b;font-weight:600;font-size:12px;}
  .print-chart .recharts-cartesian-grid line{stroke:#e2e8f0;}
  .print-chart .recharts-tooltip-wrapper{display:none!important;}
  .print-chart-section h2{margin-bottom:16px;}
  .chart-explainer{margin-top:12px;font-size:12px;color:#334155;}
  .chart-explainer strong{font-size:13px;}
  @page{margin:12mm 16mm;}
`;


export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('leasing')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isBudgetSearchOpen, setIsBudgetSearchOpen] = useState(false)
  /**
   * Flag de navegação entre a proposta financeira tradicional e a nova visão de CRM.
   * Mantemos tudo dentro da mesma SPA para evitar recarregar o app quando estivermos
   * testando localmente ou demonstrando para clientes.
   */
  const [isCrmPage, setIsCrmPage] = useState(false)
  /**
   * Estados auxiliares para monitorar a integração com o backend do CRM assim que a
   * aplicação estiver publicada em solarinvest.info. Enquanto isso, mantemos feedback
   * visual claro e evitamos chamadas remotas desnecessárias.
   */
  const [crmBackendStatus, setCrmBackendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [crmBackendError, setCrmBackendError] = useState<string | null>(null)
  const [crmLastSync, setCrmLastSync] = useState<Date | null>(null)
  /**
   * Dataset completo do CRM disponível tanto offline (via localStorage) quanto online.
   * O estado `crmIntegrationMode` sinaliza se estamos operando apenas localmente ou
   * se a sincronização com o backend remoto está ativa.
   */
  const [crmDataset, setCrmDataset] = useState<CrmDataset>(() => carregarDatasetCrmLocal())
  const [crmIntegrationMode, setCrmIntegrationMode] = useState<'local' | 'remote'>('local')
  const crmIntegrationModeRef = useRef<'local' | 'remote'>('local')
  const [crmIsSaving, setCrmIsSaving] = useState(false)
  const [crmLeadForm, setCrmLeadForm] = useState<CrmLeadFormState>({ ...CRM_EMPTY_LEAD_FORM })
  const [crmLeadSelecionadoId, setCrmLeadSelecionadoId] = useState<string | null>(null)
  const [crmBusca, setCrmBusca] = useState('')
  const [crmFiltroOperacao, setCrmFiltroOperacao] = useState<'all' | CrmOperacao>('all')
  const [crmNotaTexto, setCrmNotaTexto] = useState('')
  /**
   * Descobrimos dinamicamente se estamos rodando no domínio oficial. Essa informação
   * evita que tentemos conversar com uma API inexistente durante o desenvolvimento.
   */
  const isProductionDomain = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.location.hostname === 'solarinvest.info'
  }, [])

  /**
   * Texto amigável sobre a última sincronização realizada com o backend do CRM.
   * Utilizamos useMemo para recalcular apenas quando o timestamp muda.
   */
  const crmLastSyncTexto = useMemo(() => {
    if (!crmLastSync) {
      return null
    }
    try {
      return crmLastSync.toLocaleString('pt-BR')
    } catch (error) {
      console.warn('Falha ao formatar data de sincronização do CRM.', error)
      return crmLastSync.toISOString()
    }
  }, [crmLastSync])

  /**
   * Navegações encapsuladas em callbacks memorizados para não recriar funções a cada
   * renderização. Isso ajuda a manter o React Profiler limpo e evita renders extras.
   */
  const handleAbrirCrm = useCallback(() => {
    setIsCrmPage(true)
  }, [])

  const handleVoltarParaProposta = useCallback(() => {
    setIsCrmPage(false)
  }, [])

  useEffect(() => {
    crmIntegrationModeRef.current = crmIntegrationMode
  }, [crmIntegrationMode])

  /**
   * Assim que o usuário entrar na visão de CRM, ativamos a sincronização. Em ambiente
   * local usamos imediatamente o dataset armazenado no navegador. Quando estivermos
   * em produção tentamos buscar o bootstrap do backend real e, em caso de falha,
   * mantemos a experiência totalmente funcional com o fallback local.
   */
  useEffect(() => {
    if (!isCrmPage) {
      return
    }

    let cancelado = false
    const abortController = new AbortController()

    const carregarDataset = async () => {
      setCrmBackendStatus('loading')
      setCrmBackendError(null)

      if (!isProductionDomain) {
        const datasetLocal = carregarDatasetCrmLocal()
        if (cancelado) {
          return
        }

        setCrmIntegrationMode('local')
        setCrmDataset(datasetLocal)
        setCrmBackendStatus('success')
        setCrmLastSync(new Date())
        return
      }

      try {
        const response = await fetch(`${CRM_BACKEND_BASE_URL}/bootstrap`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Falha ao carregar bootstrap do CRM (status ${response.status})`)
        }

        const payload = await response.json()
        if (cancelado) {
          return
        }

        const datasetNormalizado = normalizarCrmDatasetRemoto(payload) ?? criarDatasetCrmPadrao()
        setCrmIntegrationMode('remote')
        setCrmDataset(datasetNormalizado)
        setCrmBackendStatus('success')
        setCrmBackendError(null)
        setCrmLastSync(new Date())

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(datasetNormalizado))
          } catch (errorStorage) {
            console.warn('Não foi possível atualizar o dataset local do CRM após bootstrap.', errorStorage)
          }
        }
      } catch (error) {
        if (abortController.signal.aborted || cancelado) {
          return
        }

        console.warn('Falha ao sincronizar com o backend do CRM, utilizando fallback local.', error)
        const fallback = carregarDatasetCrmLocal()
        setCrmIntegrationMode('local')
        setCrmDataset(fallback)
        setCrmBackendStatus('error')
        setCrmBackendError(error instanceof Error ? error.message : 'Erro inesperado ao sincronizar CRM')
      }
    }

    void carregarDataset()

    return () => {
      cancelado = true
      abortController.abort()
    }
  }, [isCrmPage, isProductionDomain])
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [orcamentoSearchTerm, setOrcamentoSearchTerm] = useState('')
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('mercado')
  const mesReferenciaRef = useRef(new Date().getMonth() + 1)
  const [ufTarifa, setUfTarifa] = useState('GO')
  const [distribuidoraTarifa, setDistribuidoraTarifa] = useState('Equatorial Goiás')
  const [ufsDisponiveis, setUfsDisponiveis] = useState<string[]>(DISTRIBUIDORAS_FALLBACK.ufs)
  const [distribuidorasPorUf, setDistribuidorasPorUf] = useState<Record<string, string[]>>(
    DISTRIBUIDORAS_FALLBACK.distribuidorasPorUf,
  )
  const [mesReajuste, setMesReajuste] = useState(6)

  const [kcKwhMes, setKcKwhMes] = useState(0)
  const [tarifaCheia, setTarifaCheia] = useState(0.964)
  const [desconto, setDesconto] = useState(20)
  const [taxaMinima, setTaxaMinima] = useState(95)
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(0)
  const [leasingPrazo, setLeasingPrazo] = useState<5 | 7 | 10>(5)
  const [potenciaPlaca, setPotenciaPlaca] = useState(550)
  const [tipoInstalacao, setTipoInstalacao] = useState<TipoInstalacao>('TELHADO')
  const [numeroPlacasManual, setNumeroPlacasManual] = useState<number | ''>('')
  const consumoAnteriorRef = useRef(kcKwhMes)

  const [cliente, setCliente] = useState<ClienteDados>({ ...CLIENTE_INICIAL })
  const [clientesSalvos, setClientesSalvos] = useState<ClienteRegistro[]>([])
  const [clienteEmEdicaoId, setClienteEmEdicaoId] = useState<string | null>(null)
  const [isClientesModalOpen, setIsClientesModalOpen] = useState(false)
  const [clienteMensagens, setClienteMensagens] = useState<{ email?: string; cidade?: string }>({})
  const [verificandoCidade, setVerificandoCidade] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const notificacaoSequencialRef = useRef(0)
  const notificacaoTimeoutsRef = useRef<Record<number, number>>({})

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteUf = cliente.uf
  const clienteDistribuidora = cliente.distribuidora

  const [precoPorKwp, setPrecoPorKwp] = useState(2470)
  const [irradiacao, setIrradiacao] = useState(IRRADIACAO_FALLBACK)
  const [eficiencia, setEficiencia] = useState(0.8)
  const [diasMes, setDiasMes] = useState(DIAS_MES_PADRAO)
  const [inflacaoAa, setInflacaoAa] = useState(8)

  const [jurosFinAa, setJurosFinAa] = useState(15)
  const [prazoFinMeses, setPrazoFinMeses] = useState(120)
  const [entradaFinPct, setEntradaFinPct] = useState(20)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(false)
  const [mostrarGrafico, setMostrarGrafico] = useState(true)

  const [prazoMeses, setPrazoMeses] = useState(60)
  const [bandeiraEncargo, setBandeiraEncargo] = useState(0)
  const [cipEncargo, setCipEncargo] = useState(0)
  const [entradaRs, setEntradaRs] = useState(0)
  const [entradaModo, setEntradaModo] = useState<EntradaModoLabel>('Crédito mensal')
  const [mostrarTabelaParcelas, setMostrarTabelaParcelas] = useState(false)
  const [mostrarTabelaBuyout, setMostrarTabelaBuyout] = useState(false)
  const [mostrarTabelaParcelasConfig, setMostrarTabelaParcelasConfig] = useState(false)
  const [mostrarTabelaBuyoutConfig, setMostrarTabelaBuyoutConfig] = useState(false)

  const [oemBase, setOemBase] = useState(35)
  const [oemInflacao, setOemInflacao] = useState(4)
  const [seguroModo, setSeguroModo] = useState<SeguroModo>('A')
  const [seguroReajuste, setSeguroReajuste] = useState(5)
  const [seguroValorA, setSeguroValorA] = useState(20)
  const [seguroPercentualB, setSeguroPercentualB] = useState(0.3)

  const [exibirLeasingLinha, setExibirLeasingLinha] = useState(true)
  const [exibirFinLinha, setExibirFinLinha] = useState(false)

  const [cashbackPct, setCashbackPct] = useState(10)
  const [depreciacaoAa, setDepreciacaoAa] = useState(12)
  const [inadimplenciaAa, setInadimplenciaAa] = useState(2)
  const [tributosAa, setTributosAa] = useState(6)
  const [ipcaAa, setIpcaAa] = useState(4)
  const [custosFixosM, setCustosFixosM] = useState(0)
  const [opexM, setOpexM] = useState(0)
  const [seguroM, setSeguroM] = useState(0)
  const [duracaoMeses, setDuracaoMeses] = useState(60)
  // Valor informado (ou calculado) de parcelas efetivamente pagas até o mês analisado, usado no crédito de cashback
  const [pagosAcumAteM, setPagosAcumAteM] = useState(0)

  const mesReferencia = mesReferenciaRef.current

  useEffect(() => {
    let cancelado = false
    const uf = ufTarifa.trim()
    const dist = distribuidoraTarifa.trim()

    if (!uf || !dist) {
      setMesReajuste(6)
      return () => {
        cancelado = true
      }
    }

    getMesReajusteFromANEEL(uf, dist)
      .then((mes) => {
        if (cancelado) return
        const normalizado = Number.isFinite(mes) ? Math.round(mes) : 6
        const ajustado = Math.min(Math.max(normalizado || 6, 1), 12)
        setMesReajuste(ajustado)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar mês de reajuste:', error)
        if (!cancelado) setMesReajuste(6)
      })

    return () => {
      cancelado = true
    }
  }, [distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    const ufAtual = (ufTarifa || clienteUf || '').trim()
    if (!ufAtual) {
      return undefined
    }

    const distribuidoraAtual = (distribuidoraTarifa || clienteDistribuidora || '').trim()
    let cancelado = false

    getTarifaCheia({ uf: ufAtual, distribuidora: distribuidoraAtual || undefined })
      .then((valor) => {
        if (cancelado) return
        if (!Number.isFinite(valor)) return

        setTarifaCheia((atual) => {
          if (!Number.isFinite(atual)) {
            return valor
          }
          return Math.abs(atual - valor) < 0.0005 ? atual : valor
        })
      })
      .catch((error) => {
        if (cancelado) return
        console.warn('[Tarifa] Não foi possível atualizar tarifa cheia automaticamente:', error)
      })

    return () => {
      cancelado = true
    }
  }, [clienteDistribuidora, clienteUf, distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    let cancelado = false

    loadDistribuidorasAneel()
      .then((dados) => {
        if (cancelado) return
        setUfsDisponiveis(dados.ufs)
        setDistribuidorasPorUf(dados.distribuidorasPorUf)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar lista de distribuidoras:', error)
      })

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    setDistribuidoraTarifa((atual) => {
      if (!ufTarifa) return ''
      const lista = distribuidorasPorUf[ufTarifa] ?? []
      if (lista.length === 1) {
        return lista[0]
      }
      return lista.includes(atual) ? atual : ''
    })
  }, [distribuidorasPorUf, ufTarifa])

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.querySelector<HTMLElement>('.app-header')
      if (header) {
        const { height } = header.getBoundingClientRect()
        document.documentElement.style.setProperty('--header-h', `${Math.round(height)}px`)
      }

      const tabs = document.querySelector<HTMLElement>('.tabs-bar')
      if (tabs) {
        const { height } = tabs.getBoundingClientRect()
        document.documentElement.style.setProperty('--tabs-h', `${Math.round(height)}px`)
      }
    }

    updateHeaderHeight()
    window.addEventListener('resize', updateHeaderHeight)
    return () => window.removeEventListener('resize', updateHeaderHeight)
  }, [])

  useEffect(() => {
    const estadoAtual = (ufTarifa || clienteUf || '').trim()
    if (!estadoAtual) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    if (!hasEstadoMinimo(estadoAtual)) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    let cancelado = false

    getIrradiacaoPorEstado(estadoAtual)
      .then(({ value, matched, via }) => {
        if (cancelado) return
        setIrradiacao((prev) => (prev === value ? prev : value))
        if (!matched) {
          console.warn(
            `[Irradiação] Estado "${estadoAtual}" não encontrado (${via}), usando fallback de ${value.toFixed(2)} kWh/m²/dia.`,
          )
        }
      })
      .catch((error) => {
        if (cancelado) return
        console.warn(
          `[Irradiação] Erro ao carregar dados para "${estadoAtual}":`,
          error,
          `— usando fallback de ${IRRADIACAO_FALLBACK.toFixed(2)} kWh/m²/dia.`,
        )
        setIrradiacao(IRRADIACAO_FALLBACK)
      })

    return () => {
      cancelado = true
    }
  }, [clienteUf, ufTarifa])

  useEffect(() => {
    const { body } = document
    if (!body) return

    if (isSettingsOpen) {
      body.style.setProperty('overflow', 'hidden')
    } else {
      body.style.removeProperty('overflow')
    }

    return () => {
      body.style.removeProperty('overflow')
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsTab('mercado')
    }
  }, [isSettingsOpen])

  const eficienciaNormalizada = useMemo(() => {
    if (eficiencia <= 0) return 0
    if (eficiencia >= 1.5) return eficiencia / 100
    return eficiencia
  }, [eficiencia])

  const baseIrradiacao = useMemo(
    () => (irradiacao > 0 ? irradiacao : 0),
    [irradiacao],
  )

  const diasMesNormalizado = useMemo(
    () => (diasMes > 0 ? diasMes : 0),
    [diasMes],
  )

  const fatorGeracaoMensal = useMemo(() => {
    if (baseIrradiacao <= 0 || eficienciaNormalizada <= 0) {
      return 0
    }
    return baseIrradiacao * eficienciaNormalizada * DIAS_MES_PADRAO
  }, [baseIrradiacao, eficienciaNormalizada])

  const numeroPlacasInformado = useMemo(() => {
    if (typeof numeroPlacasManual !== 'number') return null
    if (!Number.isFinite(numeroPlacasManual) || numeroPlacasManual <= 0) return null
    return Math.max(1, Math.round(numeroPlacasManual))
  }, [numeroPlacasManual])

  const numeroPlacasCalculado = useMemo(() => {
    if (kcKwhMes <= 0) return 0
    if (potenciaPlaca <= 0 || fatorGeracaoMensal <= 0) return 0
    const potenciaNecessaria = kcKwhMes / fatorGeracaoMensal
    const calculado = Math.ceil((potenciaNecessaria * 1000) / potenciaPlaca)
    if (!Number.isFinite(calculado)) return 0
    return Math.max(1, calculado)
  }, [kcKwhMes, fatorGeracaoMensal, potenciaPlaca])

  const potenciaInstaladaKwp = useMemo(() => {
    const placas = numeroPlacasInformado ?? numeroPlacasCalculado
    if (!placas || potenciaPlaca <= 0) return 0
    return (placas * potenciaPlaca) / 1000
  }, [numeroPlacasInformado, numeroPlacasCalculado, potenciaPlaca])

  const numeroPlacasEstimado = useMemo(() => {
    if (numeroPlacasInformado) return numeroPlacasInformado
    return numeroPlacasCalculado
  }, [numeroPlacasInformado, numeroPlacasCalculado])

  const areaInstalacao = useMemo(() => {
    if (numeroPlacasEstimado <= 0) return 0
    const fator = tipoInstalacao === 'SOLO' ? 7 : 3.3
    return numeroPlacasEstimado * fator
  }, [numeroPlacasEstimado, tipoInstalacao])

  useEffect(() => {
    const consumoAnterior = consumoAnteriorRef.current
    if (consumoAnterior === kcKwhMes) {
      return
    }

    consumoAnteriorRef.current = kcKwhMes

    setNumeroPlacasManual((valorAtual) => {
      if (valorAtual === '') {
        return valorAtual
      }

      if (kcKwhMes <= 0) {
        return ''
      }

      const valorArredondado = Math.round(Number(valorAtual))
      if (!Number.isFinite(valorArredondado)) {
        return ''
      }

      if (valorArredondado === numeroPlacasCalculado) {
        return ''
      }

      return valorAtual
    })
  }, [kcKwhMes, numeroPlacasCalculado])

  const geracaoMensalKwh = useMemo(() => {
    if (potenciaInstaladaKwp <= 0 || fatorGeracaoMensal <= 0) {
      return 0
    }
    return Math.round(potenciaInstaladaKwp * fatorGeracaoMensal)
  }, [potenciaInstaladaKwp, fatorGeracaoMensal])

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 && diasMesNormalizado > 0 ? geracaoMensalKwh / diasMesNormalizado : 0),
    [geracaoMensalKwh, diasMesNormalizado],
  )

  const encargosFixos = useMemo(
    () => Math.max(0, bandeiraEncargo + cipEncargo + encargosFixosExtras),
    [bandeiraEncargo, cipEncargo, encargosFixosExtras],
  )

  const modoEntradaNormalizado = useMemo<EntradaModo>(() => {
    if (!entradaRs || entradaRs <= 0) return 'NONE'
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (label.includes('crédito')) return 'CREDITO'
    if (label.includes('reduz')) return 'REDUZ'
    return 'NONE'
  }, [entradaModo, entradaRs])

  const capex = useMemo(() => potenciaInstaladaKwp * precoPorKwp, [potenciaInstaladaKwp, precoPorKwp])

  const simulationState = useMemo<SimulationState>(() => {
    // Mantemos o valor de mercado (vm0) amarrado ao CAPEX calculado neste mesmo memo para
    // evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, capex)
    const descontoDecimal = Math.max(0, Math.min(desconto / 100, 1))
    const inflacaoAnual = Math.max(-0.99, inflacaoAa / 100)
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: Math.max(0, Math.floor(prazoMeses)),
      taxaMinima: Math.max(0, taxaMinima),
      encargosFixos,
      entradaRs: Math.max(0, entradaRs),
      modoEntrada: modoEntradaNormalizado,
      vm0: valorMercadoBase,
      depreciacaoAa: Math.max(0, depreciacaoAa / 100),
      ipcaAa: Math.max(0, ipcaAa / 100),
      inadimplenciaAa: Math.max(0, inadimplenciaAa / 100),
      tributosAa: Math.max(0, tributosAa / 100),
      custosFixosM: Math.max(0, custosFixosM),
      opexM: Math.max(0, opexM),
      seguroM: Math.max(0, seguroM),
      cashbackPct: Math.max(0, cashbackPct / 100),
      pagosAcumManual: Math.max(0, pagosAcumAteM),
      duracaoMeses: Math.max(0, Math.floor(duracaoMeses)),
      geracaoMensalKwh: Math.max(0, geracaoMensalKwh),
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
    }
  }, [
    bandeiraEncargo,
    capex,
    cashbackPct,
    cipEncargo,
    custosFixosM,
    desconto,
    entradaRs,
    geracaoMensalKwh,
    inflacaoAa,
    inadimplenciaAa,
    ipcaAa,
    kcKwhMes,
    mesReajuste,
    modoEntradaNormalizado,
    opexM,
    pagosAcumAteM,
    prazoMeses,
    seguroM,
    tarifaCheia,
    taxaMinima,
    tributosAa,
    encargosFixosExtras,
    depreciacaoAa,
    duracaoMeses,
  ])

  const vm0 = simulationState.vm0

  const inflacaoMensal = useMemo(() => selectInflacaoMensal(simulationState), [simulationState])
  const mensalidades = useMemo(() => selectMensalidades(simulationState), [simulationState])
  const mensalidadesPorAno = useMemo(() => selectMensalidadesPorAno(simulationState), [simulationState])
  const creditoEntradaMensal = useMemo(() => selectCreditoMensal(simulationState), [simulationState])
  const kcAjustado = useMemo(() => selectKcAjustado(simulationState), [simulationState])
  const buyoutLinhas = useMemo(() => selectBuyoutLinhas(simulationState), [simulationState])

  const tarifaAno = (ano: number) =>
    tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )
  const tarifaDescontadaAno = (ano: number) =>
    tarifaDescontadaCalc(
      simulationState.tarifaCheia,
      simulationState.desconto,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )

  const leasingBeneficios = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const tarifaCheiaProj = tarifaAno(ano)
      const tarifaDescontadaProj = tarifaDescontadaAno(ano)
      const custoSemSistema = kcKwhMes * tarifaCheiaProj + encargosFixos + taxaMinima
      const custoComSistema =
        (ano <= leasingPrazo ? kcKwhMes * tarifaDescontadaProj : 0) + encargosFixos + taxaMinima
      const beneficio = 12 * (custoSemSistema - custoComSistema)
      return beneficio
    })
  }, [
    anosAnalise,
    encargosFixos,
    kcKwhMes,
    leasingPrazo,
    simulationState.desconto,
    simulationState.inflacaoAa,
    simulationState.mesReajuste,
    simulationState.mesReferencia,
    simulationState.tarifaCheia,
    taxaMinima,
  ])

  const leasingROI = useMemo(() => {
    const acc: number[] = []
    let acumulado = 0
    leasingBeneficios.forEach((beneficio) => {
      acumulado += beneficio
      acc.push(acumulado)
    })
    return acc
  }, [leasingBeneficios])

  const taxaMensalFin = useMemo(() => Math.pow(1 + jurosFinAa / 100, 1 / 12) - 1, [jurosFinAa])
  const entradaFin = useMemo(() => (capex * entradaFinPct) / 100, [capex, entradaFinPct])
  const valorFinanciado = useMemo(() => Math.max(0, capex - entradaFin), [capex, entradaFin])
  const pmt = useMemo(() => {
    if (valorFinanciado === 0) return 0
    if (prazoFinMeses <= 0) return 0
    if (taxaMensalFin === 0) return -(valorFinanciado / prazoFinMeses)
    const fator = Math.pow(1 + taxaMensalFin, prazoFinMeses)
    return -valorFinanciado * (taxaMensalFin * fator) / (fator - 1)
  }, [valorFinanciado, taxaMensalFin, prazoFinMeses])

  const custoOeM = (ano: number) => potenciaInstaladaKwp * oemBase * Math.pow(1 + oemInflacao / 100, ano - 1)
  const custoSeguro = (ano: number) => {
    if (seguroModo === 'A') {
      return potenciaInstaladaKwp * seguroValorA * Math.pow(1 + seguroReajuste / 100, ano - 1)
    }
    return vm0 * (seguroPercentualB / 100) * Math.pow(1 + seguroReajuste / 100, ano - 1)
  }

  const financiamentoFluxo = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const economia = 12 * kcKwhMes * tarifaAno(ano)
      const custoSemSistemaMensal = Math.max(kcKwhMes * tarifaAno(ano), taxaMinima)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinima, 0)
      const inicioAno = (ano - 1) * 12
      const mesesRestantes = Math.max(0, prazoFinMeses - inicioAno)
      const mesesPagos = Math.min(12, mesesRestantes)
      const custoParcela = mesesPagos * Math.abs(pmt)
      const despesasSistema = custoParcela + custoOeM(ano) + custoSeguro(ano)
      return economiaAnual - despesasSistema
    })
  }, [kcKwhMes, inflacaoAa, jurosFinAa, oemBase, oemInflacao, pmt, prazoFinMeses, seguroModo, seguroPercentualB, seguroReajuste, seguroValorA, tarifaCheia, taxaMinima, vm0, potenciaInstaladaKwp])

  const financiamentoROI = useMemo(() => {
    const valores: number[] = []
    let acumulado = -entradaFin
    financiamentoFluxo.forEach((fluxo) => {
      acumulado += fluxo
      valores.push(acumulado)
    })
    return valores
  }, [entradaFin, financiamentoFluxo])

  const financiamentoMensalidades = useMemo(() => {
    const mesesValidos = Math.max(0, prazoFinMeses)
    const anos = Math.ceil(mesesValidos / 12)
    return Array.from({ length: anos }, () => Math.abs(pmt))
  }, [pmt, prazoFinMeses])

  const parcelaMensalFin = useMemo(() => Math.abs(pmt), [pmt])
  const taxaMensalFinPct = useMemo(() => taxaMensalFin * 100, [taxaMensalFin])
  const totalPagoFinanciamento = useMemo(
    () => entradaFin + parcelaMensalFin * Math.max(prazoFinMeses, 0),
    [entradaFin, parcelaMensalFin, prazoFinMeses],
  )

  const parcelasSolarInvest = useMemo(() => {
    const lista: MensalidadeRow[] = []
    let totalAcumulado = 0
    const kcContratado =
      simulationState.modoEntrada === 'REDUZ'
        ? kcAjustado
        : Math.max(0, simulationState.kcKwhMes)
    const leasingAtivo = kcContratado > 0
    const margemMinima = Math.max(0, simulationState.taxaMinima) + Math.max(0, simulationState.encargosFixos)
    const manutencaoPrevencaoSeguroMensal =
      leasingAtivo ? Math.max(0, (simulationState.vm0 * 0.015) / 12) : 0
    mensalidades.forEach((mensalidade, index) => {
      const mes = index + 1
      const tarifaCheiaMes = tarifaProjetadaCheia(
        simulationState.tarifaCheia,
        simulationState.inflacaoAa,
        mes,
        simulationState.mesReajuste,
        simulationState.mesReferencia,
      )
      const tarifaDescontadaMes = selectTarifaDescontada(simulationState, mes)
      const energiaCheia = leasingAtivo ? Math.max(0, kcContratado * tarifaCheiaMes) : 0
      const mensalidadeCheia = Number(
        Math.max(0, energiaCheia + margemMinima + manutencaoPrevencaoSeguroMensal).toFixed(2),
      )
      totalAcumulado += mensalidade
      lista.push({
        mes,
        tarifaCheia: tarifaCheiaMes,
        tarifaDescontada: tarifaDescontadaMes,
        mensalidadeCheia,
        mensalidade: Number(mensalidade.toFixed(2)),
        totalAcumulado: Number(totalAcumulado.toFixed(2)),
      })
    })

    return {
      lista,
      tarifaDescontadaBase: selectTarifaDescontada(simulationState, 1),
      kcAjustado,
      creditoMensal: creditoEntradaMensal,
      margemMinima: simulationState.taxaMinima + simulationState.encargosFixos,
      prazoEfetivo: mensalidades.length,
      totalPago: lista.length > 0 ? lista[lista.length - 1].totalAcumulado : 0,
      inflacaoMensal,
    }
  }, [
    creditoEntradaMensal,
    inflacaoMensal,
    kcAjustado,
    mensalidades,
    simulationState,
  ])

  const leasingMensalidades = mensalidadesPorAno

  const chartData = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      return {
        ano,
        Leasing: leasingROI[i] ?? 0,
        Financiamento: financiamentoROI[i] ?? 0,
      }
    })
  }, [financiamentoROI, leasingROI])
  const beneficioAno30 = useMemo(
    () => chartData.find((row) => row.ano === 30) ?? null,
    [chartData],
  )

  const valoresGrafico = chartData.flatMap((row) => [row.Leasing, row.Financiamento])
  const minY = Math.min(...valoresGrafico, 0)
  const maxY = Math.max(...valoresGrafico, 0)
  const padding = Math.max(5_000, Math.round((maxY - minY) * 0.1))
  const yDomain: [number, number] = [Math.floor((minY - padding) / 1000) * 1000, Math.ceil((maxY + padding) / 1000) * 1000]

  const tabelaBuyout = useMemo<BuyoutRow[]>(() => {
    const horizonte = Math.max(60, Math.floor(simulationState.duracaoMeses))
    const linhasPorMes = new Map<number, BuyoutLinha>()
    buyoutLinhas.forEach((linha) => {
      linhasPorMes.set(linha.mes, linha)
    })

    const rows: BuyoutRow[] = []
    let ultimoCashback = 0
    let ultimoPrestacao = 0
    for (let mes = 1; mes <= horizonte; mes += 1) {
      const linha = linhasPorMes.get(mes)
      if (linha) {
        ultimoCashback = linha.cashback
        ultimoPrestacao = linha.prestacaoAcum
        rows.push({
          mes,
          tarifa: linha.tarifaCheia,
          prestacaoEfetiva: linha.prestacaoEfetiva,
          prestacaoAcum: linha.prestacaoAcum,
          cashback: linha.cashback,
          valorResidual: mes >= 7 && mes <= Math.floor(simulationState.duracaoMeses) ? linha.valorResidual : null,
        })
      } else {
        const fator = Math.pow(1 + inflacaoMensal, Math.max(0, mes - 1))
        const tarifaProjetada = simulationState.tarifaCheia * fator
        rows.push({
          mes,
          tarifa: tarifaProjetada,
          prestacaoEfetiva: 0,
          prestacaoAcum: ultimoPrestacao,
          cashback: ultimoCashback,
          valorResidual: null,
        })
      }
    }

    const mesAceiteFinal = Math.floor(simulationState.duracaoMeses) + 1
    const tarifaAceite = simulationState.tarifaCheia * Math.pow(1 + inflacaoMensal, Math.max(0, mesAceiteFinal - 1))
    rows.push({
      mes: mesAceiteFinal,
      tarifa: tarifaAceite,
      prestacaoEfetiva: 0,
      prestacaoAcum: ultimoPrestacao,
      cashback: ultimoCashback,
      valorResidual: 0,
    })

    return rows
  }, [buyoutLinhas, inflacaoMensal, simulationState])
  const duracaoMesesNormalizada = Math.max(0, Math.floor(duracaoMeses))
  const duracaoMesesExibicao = Math.max(7, duracaoMesesNormalizada)
  const buyoutMesAceiteFinal = duracaoMesesNormalizada + 1
  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === buyoutMesAceiteFinal) ?? null
  const buyoutReceitaRows = useMemo(
    () => tabelaBuyout.filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada),
    [tabelaBuyout, duracaoMesesNormalizada],
  )

  const buyoutResumo: BuyoutResumo = {
    vm0,
    cashbackPct: cashbackPct,
    depreciacaoPct: depreciacaoAa,
    inadimplenciaPct: inadimplenciaAa,
    tributosPct: tributosAa,
    infEnergia: inflacaoAa,
    ipca: ipcaAa,
    custosFixos: custosFixosM,
    opex: opexM,
    seguro: seguroM,
    duracao: duracaoMeses,
  }

  const printableRef = useRef<HTMLDivElement>(null)

  const anosArray = useMemo(() => Array.from({ length: anosAnalise }, (_, i) => i + 1), [])

  const printableData = useMemo<PrintableProps>(
    () => ({
      cliente,
      anos: anosArray,
      leasingROI,
      financiamentoFluxo,
      financiamentoROI,
      mostrarFinanciamento,
      tabelaBuyout,
      buyoutResumo,
      capex,
      geracaoMensalKwh,
      potenciaPlaca,
      numeroPlacas: numeroPlacasEstimado,
      potenciaInstaladaKwp,
      tipoInstalacao,
      areaInstalacao,
      descontoContratualPct: desconto,
      parcelasLeasing: parcelasSolarInvest.lista,
    }),
    [
      areaInstalacao,
      anosArray,
      buyoutResumo,
      capex,
      cliente,
      desconto,
      financiamentoFluxo,
      financiamentoROI,
      geracaoMensalKwh,
      leasingROI,
      mostrarFinanciamento,
      numeroPlacasEstimado,
      parcelasSolarInvest,
      tipoInstalacao,
      potenciaInstaladaKwp,
      potenciaPlaca,
      tabelaBuyout,
    ],
  )

  const openBudgetPreviewWindow = useCallback(
    (layoutHtml: string, { nomeCliente, budgetId, actionMessage, autoPrint, closeAfterPrint }: BudgetPreviewOptions) => {
      if (!layoutHtml) {
        window.alert('Não foi possível preparar a visualização do orçamento selecionado.')
        return
      }

      const printWindow = window.open('', '_blank', 'width=1024,height=768')
      if (!printWindow) {
        window.alert('Não foi possível abrir a visualização. Verifique se o bloqueador de pop-ups está ativo.')
        return
      }

      const mensagemToolbar =
        actionMessage || 'Revise o conteúdo e utilize as ações para imprimir ou salvar como PDF.'
      const codigoHtml = budgetId
        ? `<p class="preview-toolbar-code">Código do orçamento: <strong>${budgetId}</strong></p>`
        : ''

      const previewHtml = `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Proposta-${nomeCliente}</title>
            <style>
              ${printStyles}
              body{padding-top:88px;}
              .preview-toolbar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;background:#f8fafc;padding:16px 44px;border-bottom:1px solid #cbd5f5;box-shadow:0 2px 6px rgba(15,23,42,0.08);}
              .preview-toolbar-info{display:flex;flex-direction:column;gap:4px;max-width:65%;}
              .preview-toolbar-info h1{margin:0;font-size:18px;color:#0f172a;}
              .preview-toolbar-info p{margin:0;font-size:13px;color:#475569;}
              .preview-toolbar-code strong{color:#0f172a;}
              .preview-toolbar-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
              .preview-toolbar-actions button{background:#0f172a;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;}
              .preview-toolbar-actions button:hover{background:#1e293b;}
              .preview-toolbar-actions button.secondary{background:#e2e8f0;color:#0f172a;}
              .preview-toolbar-actions button.secondary:hover{background:#cbd5f5;color:#0f172a;}
              .preview-container{max-width:1040px;margin:0 auto;}
              @media print{
                body{padding-top:0;}
                .preview-toolbar{display:none;}
              }
            </style>
          </head>
          <body>
            <div class="preview-toolbar">
              <div class="preview-toolbar-info">
                <h1>Pré-visualização da proposta</h1>
                <p>${mensagemToolbar}</p>
                ${codigoHtml}
              </div>
              <div class="preview-toolbar-actions">
                <button type="button" data-action="print">Imprimir</button>
                <button type="button" data-action="download">Baixar PDF</button>
                <button type="button" data-action="close" class="secondary">Fechar</button>
              </div>
            </div>
            <div class="preview-container">${layoutHtml}</div>
            <script>
              (function(){
                var shouldAutoPrint = ${autoPrint ? 'true' : 'false'};
                var shouldCloseAfterPrint = ${closeAfterPrint ? 'true' : 'false'};
                var printBtn = document.querySelector('[data-action=\"print\"]');
                var downloadBtn = document.querySelector('[data-action=\"download\"]');
                var closeBtn = document.querySelector('[data-action=\"close\"]');
                if(printBtn){
                  printBtn.addEventListener('click', function(){ window.print(); });
                }
                if(downloadBtn){
                  downloadBtn.addEventListener('click', function(){ window.print(); });
                }
                if(closeBtn){
                  closeBtn.addEventListener('click', function(){ window.close(); });
                }
                if(shouldAutoPrint){
                  window.addEventListener('load', function(){ window.setTimeout(function(){ window.print(); }, 320); });
                }
                if(shouldCloseAfterPrint){
                  window.addEventListener('afterprint', function(){ window.setTimeout(function(){ window.close(); }, 180); });
                }
              })();
            </script>
          </body>
        </html>`

      const { document } = printWindow
      document.open()
      document.write(previewHtml)
      document.close()
      printWindow.focus()
    },
    [],
  )

  const validarCamposObrigatorios = useCallback(
    (acao: string = 'exportar') => {
      const faltantes = CAMPOS_CLIENTE_OBRIGATORIOS.filter(({ key }) => !cliente[key].trim())
      if (faltantes.length > 0) {
        const mensagem = `Preencha os campos obrigatórios antes de ${acao}: ${faltantes
          .map((campo) => campo.label)
          .join(', ')}`
        window.alert(mensagem)
        return false
      }
      return true
    },
    [cliente],
  )

  const carregarClientesSalvos = useCallback((): ClienteRegistro[] => {
    if (typeof window === 'undefined') {
      return []
    }

    const existenteRaw = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
    if (!existenteRaw) {
      return []
    }

    try {
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      const agora = new Date().toISOString()
      return parsed
        .map((item) => {
          const registro = item as Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> }
          const dados = registro.dados ?? (registro as unknown as { cliente?: Partial<ClienteDados> }).cliente ?? {}
          const normalizado: ClienteRegistro = {
            id: registro.id ?? generateClienteId(),
            criadoEm: registro.criadoEm ?? agora,
            atualizadoEm: registro.atualizadoEm ?? registro.criadoEm ?? agora,
            dados: {
              nome: dados?.nome ?? '',
              documento: dados?.documento ?? '',
              email: dados?.email ?? '',
              telefone: dados?.telefone ?? '',
              distribuidora: dados?.distribuidora ?? '',
              uc: dados?.uc ?? '',
              endereco: dados?.endereco ?? '',
              cidade: dados?.cidade ?? '',
              uf: dados?.uf ?? '',
            },
          }
          return normalizado
        })
        .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))
    } catch (error) {
      console.warn('Não foi possível interpretar os clientes salvos existentes.', error)
      return []
    }
  }, [])

  useEffect(() => {
    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)
  }, [carregarClientesSalvos])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') {
        return
      }

      Object.values(notificacaoTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  const removerNotificacao = useCallback((id: number) => {
    setNotificacoes((prev) => prev.filter((item) => item.id !== id))

    const timeoutId = notificacaoTimeoutsRef.current[id]
    if (timeoutId && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId)
    }
    delete notificacaoTimeoutsRef.current[id]
  }, [])

  const adicionarNotificacao = useCallback(
    (mensagem: string, tipo: NotificacaoTipo = 'info') => {
      notificacaoSequencialRef.current += 1
      const id = notificacaoSequencialRef.current

      setNotificacoes((prev) => [...prev, { id, mensagem, tipo }])

      if (typeof window !== 'undefined') {
        const timeoutId = window.setTimeout(() => removerNotificacao(id), 5000)
        notificacaoTimeoutsRef.current[id] = timeoutId
      }
    },
    [removerNotificacao],
  )

  /**
   * Centralizamos a persistência do dataset do CRM. Sempre que algo mudar salvamos
   * uma cópia no navegador e, se estivermos conectados ao backend oficial, enviamos
   * o snapshot atualizado.
   */
  const persistCrmDataset = useCallback(
    async (dataset: CrmDataset, origem: 'auto' | 'manual' = 'auto') => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(dataset))
        } catch (error) {
          console.warn('Não foi possível persistir o dataset do CRM no localStorage.', error)
        }
      }

      if (crmIntegrationModeRef.current !== 'remote') {
        return
      }

      try {
        setCrmIsSaving(true)
        const response = await fetch(`${CRM_BACKEND_BASE_URL}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dataset, origem }),
        })

        if (!response.ok) {
          throw new Error(`Falha ao sincronizar dataset do CRM (status ${response.status})`)
        }

        setCrmBackendStatus('success')
        setCrmBackendError(null)
        setCrmLastSync(new Date())
      } catch (error) {
        console.warn('Erro ao sincronizar CRM remoto, mantendo operação local.', error)
        setCrmBackendStatus('error')
        setCrmBackendError(error instanceof Error ? error.message : 'Erro inesperado ao sincronizar CRM')
        setCrmIntegrationMode('local')
        adicionarNotificacao('Backend do CRM indisponível, utilizando persistência local.', 'error')
      } finally {
        setCrmIsSaving(false)
      }
    },
    [adicionarNotificacao],
  )

  useEffect(() => {
    void persistCrmDataset(crmDataset)
  }, [crmDataset, persistCrmDataset])

  const crmLeadSelecionado = useMemo(
    () => crmDataset.leads.find((lead) => lead.id === crmLeadSelecionadoId) ?? null,
    [crmDataset.leads, crmLeadSelecionadoId],
  )

  const crmLeadsFiltrados = useMemo(() => {
    const termoNormalizado = crmBusca ? normalizeText(crmBusca) : ''
    const numerosBusca = crmBusca ? normalizeNumbers(crmBusca) : ''

    return crmDataset.leads.filter((lead) => {
      const correspondeOperacao = crmFiltroOperacao === 'all' || lead.tipoOperacao === crmFiltroOperacao

      if (!correspondeOperacao) {
        return false
      }

      if (!termoNormalizado && !numerosBusca) {
        return true
      }

      const camposTexto = [lead.nome, lead.cidade, lead.tipoImovel, lead.origemLead]
      const encontrouTexto = termoNormalizado
        ? camposTexto.some((campo) => normalizeText(campo).includes(termoNormalizado))
        : false

      const encontrouTelefone = numerosBusca
        ? normalizeNumbers(lead.telefone).includes(numerosBusca)
        : false

      return encontrouTexto || encontrouTelefone
    })
  }, [crmDataset.leads, crmBusca, crmFiltroOperacao])

  const crmLeadsPorEtapa = useMemo(() => {
    const agrupado: Record<CrmStageId, CrmLeadRecord[]> = CRM_PIPELINE_STAGES.reduce(
      (acc, stage) => {
        acc[stage.id] = []
        return acc
      },
      {} as Record<CrmStageId, CrmLeadRecord[]>,
    )

    crmLeadsFiltrados.forEach((lead) => {
      agrupado[lead.etapa]?.push(lead)
    })

    CRM_PIPELINE_STAGES.forEach((stage) => {
      agrupado[stage.id].sort((a, b) => (a.ultimoContatoIso < b.ultimoContatoIso ? 1 : -1))
    })

    return agrupado
  }, [crmLeadsFiltrados])

  const crmKpis = useMemo(() => {
    const totalLeads = crmDataset.leads.length
    const leadsFechados = crmDataset.leads.filter((lead) => lead.etapa === 'fechado')
    const stageAguardandoIndex = CRM_STAGE_INDEX['aguardando-contrato']
    const leadsComContrato = crmDataset.leads.filter(
      (lead) => CRM_STAGE_INDEX[lead.etapa] >= stageAguardandoIndex,
    )

    const receitaRecorrente = leadsComContrato
      .filter((lead) => lead.tipoOperacao === 'LEASING')
      .reduce((total, lead) => total + lead.valorEstimado, 0)

    const receitaPontual = leadsFechados
      .filter((lead) => lead.tipoOperacao === 'VENDA_DIRETA')
      .reduce((total, lead) => total + lead.valorEstimado, 0)

    const leadsEmRisco = crmDataset.leads.filter((lead) => {
      const diasSemContato = diasDesdeDataIso(lead.ultimoContatoIso)
      const indiceEtapa = CRM_STAGE_INDEX[lead.etapa]
      return indiceEtapa >= CRM_STAGE_INDEX['proposta-enviada'] && indiceEtapa <= CRM_STAGE_INDEX['negociacao'] && diasSemContato >= 3
    })

    return {
      totalLeads,
      leadsFechados: leadsFechados.length,
      receitaRecorrente,
      receitaPontual,
      leadsEmRisco: leadsEmRisco.length,
    }
  }, [crmDataset.leads])

  const crmTimelineFiltrada = useMemo(() => {
    const base = crmLeadSelecionadoId
      ? crmDataset.timeline.filter((item) => item.leadId === crmLeadSelecionadoId)
      : crmDataset.timeline

    return base.slice(0, 40)
  }, [crmDataset.timeline, crmLeadSelecionadoId])

  const handleCrmLeadFormChange = useCallback(<K extends keyof CrmLeadFormState>(campo: K, valor: CrmLeadFormState[K]) => {
    setCrmLeadForm((prev) => ({ ...prev, [campo]: valor }))
  }, [])

  const handleCrmLeadFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const consumoNumerico = Number(crmLeadForm.consumoKwhMes.replace(',', '.'))
      const valorEstimadoNumerico = Number(crmLeadForm.valorEstimado.replace(',', '.'))

      if (!crmLeadForm.nome.trim() || !crmLeadForm.telefone.trim() || !crmLeadForm.cidade.trim()) {
        adicionarNotificacao('Informe nome, telefone e cidade para cadastrar o lead.', 'error')
        return
      }

      if (!Number.isFinite(consumoNumerico) || consumoNumerico <= 0) {
        adicionarNotificacao('Consumo mensal inválido. Utilize apenas números.', 'error')
        return
      }

      if (!Number.isFinite(valorEstimadoNumerico) || valorEstimadoNumerico <= 0) {
        adicionarNotificacao('Defina o valor estimado do projeto para projeções financeiras.', 'error')
        return
      }

      const agoraIso = new Date().toISOString()
      const novoLead: CrmLeadRecord = {
        id: gerarIdCrm('lead'),
        nome: crmLeadForm.nome.trim(),
        telefone: crmLeadForm.telefone.trim(),
        email: crmLeadForm.email.trim() || undefined,
        cidade: crmLeadForm.cidade.trim(),
        tipoImovel: crmLeadForm.tipoImovel.trim() || 'Não informado',
        consumoKwhMes: Math.round(consumoNumerico),
        origemLead: crmLeadForm.origemLead.trim() || 'Cadastro manual',
        interesse: crmLeadForm.interesse,
        tipoOperacao: crmLeadForm.tipoOperacao,
        valorEstimado: Math.round(valorEstimadoNumerico),
        etapa: 'novo-lead',
        ultimoContatoIso: agoraIso,
        criadoEmIso: agoraIso,
        notas: crmLeadForm.notas.trim() || undefined,
      }

      const evento: CrmTimelineEntry = {
        id: gerarIdCrm('evento'),
        leadId: novoLead.id,
        mensagem: `Lead "${novoLead.nome}" cadastrado manualmente e posicionado em Novo lead.`,
        tipo: 'status',
        criadoEmIso: agoraIso,
      }

      setCrmDataset((prev) => ({
        leads: [novoLead, ...prev.leads],
        timeline: [evento, ...prev.timeline].slice(0, 120),
      }))

      setCrmLeadForm((prev) => ({
        ...CRM_EMPTY_LEAD_FORM,
        interesse: prev.interesse,
        tipoOperacao: prev.tipoOperacao,
      }))
      setCrmLeadSelecionadoId(novoLead.id)
      setCrmNotaTexto('')
      adicionarNotificacao('Lead adicionado ao funil do CRM.', 'success')
    },
    [adicionarNotificacao, crmLeadForm],
  )

  const handleMoverLead = useCallback(
    (leadId: string, direcao: 1 | -1) => {
      let mensagemSucesso: string | null = null

      setCrmDataset((prev) => {
        const leadAtual = prev.leads.find((lead) => lead.id === leadId)
        if (!leadAtual) {
          return prev
        }

        const indiceAtual = CRM_STAGE_INDEX[leadAtual.etapa]
        const novoIndice = Math.min(
          CRM_PIPELINE_STAGES.length - 1,
          Math.max(0, indiceAtual + direcao),
        )

        if (novoIndice === indiceAtual) {
          return prev
        }

        const novaEtapa = CRM_PIPELINE_STAGES[novoIndice].id
        const agoraIso = new Date().toISOString()
        mensagemSucesso = `Lead "${leadAtual.nome}" movido para ${CRM_PIPELINE_STAGES[novoIndice].label}.`

        const leadsAtualizados = prev.leads.map((lead) =>
          lead.id === leadId
            ? { ...lead, etapa: novaEtapa, ultimoContatoIso: agoraIso }
            : lead,
        )

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId,
          mensagem: `Etapa atualizada de ${CRM_PIPELINE_STAGES[indiceAtual].label} para ${CRM_PIPELINE_STAGES[novoIndice].label}.`,
          tipo: 'status',
          criadoEmIso: agoraIso,
        }

        return {
          leads: leadsAtualizados,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      if (mensagemSucesso) {
        adicionarNotificacao(mensagemSucesso, 'success')
      }
    },
    [adicionarNotificacao],
  )

  const handleSelecionarLead = useCallback((leadId: string) => {
    setCrmLeadSelecionadoId((prev) => (prev === leadId ? null : leadId))
  }, [])

  const handleAdicionarNotaCrm = useCallback(() => {
    if (!crmLeadSelecionadoId) {
      adicionarNotificacao('Selecione um lead para registrar uma nota.', 'info')
      return
    }

    const notaLimpa = crmNotaTexto.trim()
    if (!notaLimpa) {
      adicionarNotificacao('Escreva uma nota antes de salvar.', 'error')
      return
    }

    const agoraIso = new Date().toISOString()
    const evento: CrmTimelineEntry = {
      id: gerarIdCrm('evento'),
      leadId: crmLeadSelecionadoId,
      mensagem: notaLimpa,
      tipo: 'anotacao',
      criadoEmIso: agoraIso,
    }

    setCrmDataset((prev) => ({
      leads: prev.leads.map((lead) =>
        lead.id === crmLeadSelecionadoId
          ? {
              ...lead,
              notas: notaLimpa,
              ultimoContatoIso: agoraIso,
            }
          : lead,
      ),
      timeline: [evento, ...prev.timeline].slice(0, 120),
    }))

    setCrmNotaTexto('')
    adicionarNotificacao('Nota registrada no histórico do lead.', 'success')
  }, [adicionarNotificacao, crmLeadSelecionadoId, crmNotaTexto])

  const handleRemoverLead = useCallback(
    (leadId: string) => {
      let nomeLead: string | null = null

      setCrmDataset((prev) => {
        const leadAtual = prev.leads.find((lead) => lead.id === leadId)
        if (!leadAtual) {
          return prev
        }
        nomeLead = leadAtual.nome
        const agoraIso = new Date().toISOString()

        const leadsRestantes = prev.leads.filter((lead) => lead.id !== leadId)
        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId,
          mensagem: `Lead removido do funil pelo usuário em ${formatarDataCurta(agoraIso)}.`,
          tipo: 'status',
          criadoEmIso: agoraIso,
        }

        return {
          leads: leadsRestantes,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      if (nomeLead && crmLeadSelecionadoId === leadId) {
        setCrmLeadSelecionadoId(null)
      }

      if (nomeLead) {
        adicionarNotificacao(`Lead "${nomeLead}" removido do CRM.`, 'info')
      }
    },
    [adicionarNotificacao, crmLeadSelecionadoId],
  )

  const handleSalvarCliente = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!validarCamposObrigatorios('salvar o cliente')) {
      return
    }

    const dadosClonados = cloneClienteDados(cliente)
    const agoraIso = new Date().toISOString()
    const estaEditando = Boolean(clienteEmEdicaoId)
    let registroSalvo: ClienteRegistro | null = null
    let houveErro = false

    setClientesSalvos((prevRegistros) => {
      let registrosAtualizados: ClienteRegistro[] = prevRegistros
      let registroAtualizado: ClienteRegistro | null = null

      if (clienteEmEdicaoId) {
        let encontrado = false
        registrosAtualizados = prevRegistros.map((registro) => {
          if (registro.id === clienteEmEdicaoId) {
            encontrado = true
            const atualizado: ClienteRegistro = {
              ...registro,
              dados: dadosClonados,
              atualizadoEm: agoraIso,
            }
            registroAtualizado = atualizado
            return atualizado
          }
          return registro
        })

        if (!encontrado) {
          registroAtualizado = {
            id: generateClienteId(),
            criadoEm: agoraIso,
            atualizadoEm: agoraIso,
            dados: dadosClonados,
          }
          registrosAtualizados = [registroAtualizado, ...prevRegistros]
        }
      } else {
        registroAtualizado = {
          id: generateClienteId(),
          criadoEm: agoraIso,
          atualizadoEm: agoraIso,
          dados: dadosClonados,
        }
        registrosAtualizados = [registroAtualizado, ...prevRegistros]
      }

      if (!registroAtualizado) {
        registroAtualizado = {
          id: generateClienteId(),
          criadoEm: agoraIso,
          atualizadoEm: agoraIso,
          dados: dadosClonados,
        }
        registrosAtualizados = [registroAtualizado, ...prevRegistros]
      }

      const ordenados = [...registrosAtualizados].sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

      try {
        window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ordenados))
      } catch (error) {
        console.error('Erro ao salvar cliente localmente.', error)
        window.alert('Não foi possível salvar o cliente. Tente novamente.')
        houveErro = true
        return prevRegistros
      }

      registroSalvo = registroAtualizado
      return ordenados
    })

    if (houveErro || !registroSalvo) {
      return
    }

    setClienteEmEdicaoId(registroSalvo.id)
    adicionarNotificacao(
      estaEditando ? 'Dados do cliente atualizados com sucesso.' : 'Cliente salvo com sucesso.',
      'success',
    )
  }, [adicionarNotificacao, cliente, clienteEmEdicaoId, setClienteEmEdicaoId, validarCamposObrigatorios])

  const handleEditarCliente = useCallback(
    (registro: ClienteRegistro) => {
      setCliente(cloneClienteDados(registro.dados))
      setClienteMensagens({})
      setClienteEmEdicaoId(registro.id)
      setIsClientesModalOpen(false)
      setActiveTab('cliente')
    },
    [setActiveTab, setCliente, setClienteEmEdicaoId, setClienteMensagens, setIsClientesModalOpen],
  )

  const handleExcluirCliente = useCallback(
    (registro: ClienteRegistro) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.dados.nome?.trim() || 'este cliente'
      const confirmado = window.confirm(
        `Deseja realmente excluir ${nomeCliente}? Essa ação não poderá ser desfeita.`,
      )
      if (!confirmado) {
        return
      }

      let removeuEdicaoAtual = false
      let houveErro = false

      setClientesSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((item) => item.id !== registro.id)
        if (registrosAtualizados.length === prevRegistros.length) {
          return prevRegistros
        }

        try {
          if (registrosAtualizados.length > 0) {
            window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registrosAtualizados))
          } else {
            window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
          }
        } catch (error) {
          console.error('Erro ao excluir cliente salvo.', error)
          window.alert('Não foi possível atualizar os clientes salvos. Tente novamente.')
          houveErro = true
          return prevRegistros
        }

        if (clienteEmEdicaoId === registro.id) {
          removeuEdicaoAtual = true
        }

        return registrosAtualizados
      })

      if (houveErro) {
        return
      }

      if (removeuEdicaoAtual) {
        setCliente({ ...CLIENTE_INICIAL })
        setClienteMensagens({})
        setClienteEmEdicaoId(null)
      }
    },
    [clienteEmEdicaoId, setCliente, setClienteEmEdicaoId, setClienteMensagens],
  )

  const abrirClientesModal = () => {
    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)
    setIsClientesModalOpen(true)
    setIsSettingsOpen(false)
  }

  const fecharClientesModal = () => {
    setIsClientesModalOpen(false)
  }

  const carregarOrcamentosSalvos = useCallback((): OrcamentoSalvo[] => {
    if (typeof window === 'undefined') {
      return []
    }

    const existenteRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    if (!existenteRaw) {
      return []
    }

    try {
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed.map((item) => {
        const registro = item as OrcamentoSalvo
        return {
          ...registro,
          clienteDocumento: registro.clienteDocumento ?? registro.dados?.cliente.documento ?? '',
          clienteUc: registro.clienteUc ?? registro.dados?.cliente.uc ?? '',
        }
      })
    } catch (error) {
      console.warn('Não foi possível interpretar os orçamentos salvos existentes.', error)
      return []
    }
  }, [])

  const salvarOrcamentoLocalmente = (dados: PrintableProps): OrcamentoSalvo | null => {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const registrosExistentes = carregarOrcamentosSalvos()
      const existingIds = new Set(registrosExistentes.map((registro) => registro.id))
      const registro: OrcamentoSalvo = {
        id: generateBudgetId(existingIds),
        criadoEm: new Date().toISOString(),
        clienteNome: dados.cliente.nome,
        clienteCidade: dados.cliente.cidade,
        clienteUf: dados.cliente.uf,
        clienteDocumento: dados.cliente.documento,
        clienteUc: dados.cliente.uc,
        dados: clonePrintableData(dados),
      }

      existingIds.add(registro.id)
      const registrosAtualizados = [registro, ...registrosExistentes]
      window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(registrosAtualizados))
      setOrcamentosSalvos(registrosAtualizados)
      return registro
    } catch (error) {
      console.error('Erro ao salvar orçamento localmente.', error)
      window.alert('Não foi possível salvar o orçamento. Tente novamente.')
      return null
    }
  }

  const removerOrcamentoSalvo = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') {
        return
      }

      setOrcamentosSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((registro) => registro.id !== id)

        try {
          if (registrosAtualizados.length > 0) {
            window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(registrosAtualizados))
          } else {
            window.localStorage.removeItem(BUDGETS_STORAGE_KEY)
          }
        } catch (error) {
          console.error('Erro ao atualizar os orçamentos salvos.', error)
          window.alert('Não foi possível atualizar os orçamentos salvos. Tente novamente.')
          return prevRegistros
        }

        return registrosAtualizados
      })
    },
    [setOrcamentosSalvos],
  )

  const handleEficienciaInput = (valor: number) => {
    if (!Number.isFinite(valor)) {
      setEficiencia(0)
      return
    }
    if (valor <= 0) {
      setEficiencia(0)
      return
    }
    if (valor >= 1.5) {
      setEficiencia(valor / 100)
      return
    }
    setEficiencia(valor)
  }
  const handlePrint = () => {
    if (!validarCamposObrigatorios()) {
      return
    }

    const registroOrcamento = salvarOrcamentoLocalmente(printableData)
    if (!registroOrcamento) {
      return
    }

    const node = printableRef.current
    if (!node) {
      window.alert('Não foi possível gerar a visualização para impressão. Tente novamente.')
      return
    }

    const nomeCliente = printableData.cliente.nome?.trim() || 'SolarInvest'
    openBudgetPreviewWindow(node.outerHTML, {
      nomeCliente,
      budgetId: registroOrcamento.id,
      actionMessage: 'Revise o conteúdo e utilize as ações para gerar o PDF.',
    })
  }

  const allCurvesHidden = !exibirLeasingLinha && (!mostrarFinanciamento || !exibirFinLinha)

  const handleClienteChange = (key: keyof ClienteDados, value: string) => {
    let nextValue = value

    if (key === 'documento') {
      nextValue = formatCpfCnpj(value)
    } else if (key === 'email') {
      nextValue = value.trim()
    } else if (key === 'uf') {
      nextValue = value.toUpperCase()
    }

    setCliente((prev) => ({ ...prev, [key]: nextValue }))

    if (key === 'email') {
      const trimmed = nextValue.trim()
      setClienteMensagens((prev) => ({
        ...prev,
        email: trimmed && !emailValido(trimmed) ? 'Informe um e-mail válido.' : undefined,
      }))
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nomeCidade = cliente.cidade.trim()
    const ufSelecionada = cliente.uf.trim().toUpperCase()

    if (nomeCidade.length < 3) {
      setVerificandoCidade(false)
      setClienteMensagens((prev) => ({ ...prev, cidade: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      if (!ativo) {
        return
      }

      setClienteMensagens((prev) => ({ ...prev, cidade: undefined }))
      setVerificandoCidade(true)

      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(nomeCidade)}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Falha ao buscar municípios no IBGE.')
        }

        const data: IbgeMunicipio[] = await response.json()
        if (!ativo) {
          return
        }

        let aviso: string | undefined
        if (!Array.isArray(data) || data.length === 0) {
          aviso = 'Cidade não encontrada na base do IBGE.'
        } else {
          const cidadeNormalizada = normalizeText(nomeCidade)
          const possuiNome = data.some((municipio) => normalizeText(municipio?.nome ?? '') === cidadeNormalizada)

          if (!possuiNome) {
            aviso = 'Cidade não encontrada na base do IBGE.'
          } else if (ufSelecionada) {
            const existeNoEstado = data.some((municipio) => {
              if (normalizeText(municipio?.nome ?? '') !== cidadeNormalizada) {
                return false
              }

              const sigla = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? ''
              return sigla.toUpperCase() === ufSelecionada
            })

            if (!existeNoEstado) {
              aviso = `Cidade não encontrada no estado ${ufSelecionada}.`
            }
          }
        }

        setClienteMensagens((prev) => ({ ...prev, cidade: aviso }))
      } catch (error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cidade: 'Não foi possível verificar a cidade agora.',
        }))
      } finally {
        if (ativo) {
          setVerificandoCidade(false)
        }
      }
    }, 400)

    return () => {
      ativo = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [cliente.cidade, cliente.uf])

  const abrirOrcamentoSalvo = useCallback(
    async (registro: OrcamentoSalvo, modo: 'preview' | 'print' | 'download') => {
      try {
        const layoutHtml = await renderPrintableProposalToHtml(registro.dados)
        if (!layoutHtml) {
          window.alert('Não foi possível preparar o orçamento selecionado. Tente novamente.')
          return
        }

        const nomeCliente = registro.dados.cliente.nome?.trim() || 'SolarInvest'
        let actionMessage = 'Revise o conteúdo e utilize as ações para gerar o PDF.'
        if (modo === 'print') {
          actionMessage = 'A janela de impressão será aberta automaticamente. Verifique as preferências antes de confirmar.'
        } else if (modo === 'download') {
          actionMessage =
            'Escolha a opção "Salvar como PDF" na janela de impressão para baixar o orçamento.'
        }

        openBudgetPreviewWindow(layoutHtml, {
          nomeCliente,
          budgetId: registro.id,
          actionMessage,
          autoPrint: modo !== 'preview',
          closeAfterPrint: modo === 'download',
        })
      } catch (error) {
        console.error('Erro ao abrir orçamento salvo.', error)
        window.alert('Não foi possível abrir o orçamento selecionado. Tente novamente.')
      }
    },
    [openBudgetPreviewWindow],
  )

  const confirmarRemocaoOrcamento = useCallback(
    (registro: OrcamentoSalvo) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.clienteNome || registro.dados.cliente.nome || 'este cliente'
      const confirmado = window.confirm(
        `Deseja realmente excluir o orçamento ${registro.id} de ${nomeCliente}? Essa ação não poderá ser desfeita.`,
      )

      if (!confirmado) {
        return
      }

      removerOrcamentoSalvo(registro.id)
    },
    [removerOrcamentoSalvo],
  )

  const orcamentosFiltrados = useMemo(() => {
    if (!orcamentoSearchTerm.trim()) {
      return orcamentosSalvos
    }

    const queryText = normalizeText(orcamentoSearchTerm.trim())
    const queryDigits = normalizeNumbers(orcamentoSearchTerm)

    return orcamentosSalvos.filter((registro) => {
      const codigo = normalizeText(registro.id)
      const codigoDigits = normalizeNumbers(registro.id)
      const nome = normalizeText(registro.clienteNome || registro.dados.cliente.nome || '')
      const documentoRaw = registro.clienteDocumento || registro.dados.cliente.documento || ''
      const documentoTexto = normalizeText(documentoRaw)
      const documentoDigits = normalizeNumbers(documentoRaw)
      const ucRaw = registro.clienteUc || registro.dados.cliente.uc || ''
      const ucTexto = normalizeText(ucRaw)
      const ucDigits = normalizeNumbers(ucRaw)

      if (codigo.includes(queryText) || nome.includes(queryText) || documentoTexto.includes(queryText) || ucTexto.includes(queryText)) {
        return true
      }

      if (!queryDigits) {
        return false
      }

      return (
        codigoDigits.includes(queryDigits) ||
        documentoDigits.includes(queryDigits) ||
        ucDigits.includes(queryDigits)
      )
    })
  }, [orcamentoSearchTerm, orcamentosSalvos])

  const totalOrcamentos = orcamentosSalvos.length
  const totalResultados = orcamentosFiltrados.length

  const abrirPesquisaOrcamentos = () => {
    const registros = carregarOrcamentosSalvos()
    setOrcamentosSalvos(registros)
    setOrcamentoSearchTerm('')
    setIsSettingsOpen(false)
    setIsBudgetSearchOpen(true)
  }

  const fecharPesquisaOrcamentos = () => {
    setIsBudgetSearchOpen(false)
  }

  const renderParametrosPrincipaisSection = () => (
    <section className="card">
      <h2>Parâmetros principais</h2>
      <div className="grid g3">
        <Field label="Consumo (kWh/mês)">
          <input
            type="number"
            value={kcKwhMes}
            onChange={(e) => setKcKwhMes(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Tarifa cheia (R$/kWh)">
          <input
            type="number"
            step="0.001"
            value={tarifaCheia}
            onChange={(e) => setTarifaCheia(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Desconto contratual (%)">
          <input
            type="number"
            step="0.1"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Taxa mínima (R$/mês)">
          <input
            type="number"
            value={taxaMinima}
            onChange={(e) => setTaxaMinima(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Encargos adicionais (R$/mês)">
          <input
            type="number"
            value={encargosFixosExtras}
            onChange={(e) => setEncargosFixosExtras(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Prazo do leasing">
          <select value={leasingPrazo} onChange={(e) => setLeasingPrazo(Number(e.target.value) as 5 | 7 | 10)}>
            <option value={5}>5 anos</option>
            <option value={7}>7 anos</option>
            <option value={10}>10 anos</option>
          </select>
        </Field>
        <Field label="UF (ANEEL)">
          <select
            value={ufTarifa}
            onChange={(e) => setUfTarifa(e.target.value)}
          >
            <option value="">Selecione a UF</option>
            {ufsDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf} — {UF_LABELS[uf] ?? uf}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Distribuidora (ANEEL)">
          <select
            value={distribuidoraTarifa}
            onChange={(e) => setDistribuidoraTarifa(e.target.value)}
            disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
          >
            <option value="">
              {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF'}
            </option>
            {distribuidorasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            <>
              Irradiação média (kWh/m²/dia)
              <InfoTooltip text="Irradiação média é preenchida automaticamente a partir da UF/distribuidora ou do valor configurado manualmente." />
            </>
          }
          hint="Atualizado automaticamente conforme a UF ou distribuidora selecionada."
        >
          <input readOnly value={baseIrradiacao > 0 ? baseIrradiacao.toFixed(2) : '—'} />
        </Field>
      </div>
    </section>
  )

  const renderConfiguracaoUsinaSection = () => (
    <section className="card">
      <h2>Configuração da Usina Fotovoltaica</h2>
      <div className="grid g4">
        <Field label="Potência da placa (Wp)">
          <select value={potenciaPlaca} onChange={(e) => setPotenciaPlaca(Number(e.target.value))}>
            {painelOpcoes.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </Field>
        <Field label="Nº de placas (estimado)">
          <input
            type="number"
            min={1}
            value={
              numeroPlacasManual === ''
                ? numeroPlacasEstimado > 0
                  ? numeroPlacasEstimado
                  : ''
                : numeroPlacasManual
            }
            onChange={(e) => {
              const { value } = e.target
              if (value === '') {
                setNumeroPlacasManual('')
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setNumeroPlacasManual('')
                return
              }
              setNumeroPlacasManual(parsed)
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Tipo de instalação">
          <select
            value={tipoInstalacao}
            onChange={(event) => setTipoInstalacao(event.target.value as TipoInstalacao)}
          >
            <option value="TELHADO">Telhado</option>
            <option value="SOLO">Solo</option>
          </select>
        </Field>
        <Field
          label={
            <>
              Potência instalada (kWp)
              <InfoTooltip text="Potência instalada = (Nº de placas × Potência da placa) ÷ 1000. Sem entrada manual de placas, estimamos por Consumo ÷ (Irradiação × Eficiência × 30 dias)." />
            </>
          }
        >
          <input readOnly value={potenciaInstaladaKwp.toFixed(2)} />
        </Field>
        <Field
          label={
            <>
              Geração estimada (kWh/mês)
              <InfoTooltip text="Geração estimada = Potência instalada × Irradiação média × Eficiência × 30 dias." />
            </>
          }
        >
          <input readOnly value={geracaoMensalKwh.toFixed(0)} />
        </Field>
        <Field
          label={
            <>
              Área utilizada (m²)
              <InfoTooltip text="Área utilizada = Nº de placas × 3,3 m² (telhado) ou × 7 m² (solo)." />
            </>
          }
        >
          <input
            readOnly
            value={
              areaInstalacao > 0
                ? areaInstalacao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : '—'
            }
          />
        </Field>
      </div>
      <div className="info-inline">
        <span className="pill">
          <InfoTooltip text="Valor de mercado = Potência instalada (kWp) × Preço por kWp configurado nas definições." />
          Valor de Mercado Estimado
          <strong>{currency(capex)}</strong>
        </span>
        <span className="pill">
          <InfoTooltip text="Consumo diário estimado = Geração mensal ÷ Dias considerados no mês." />
          Consumo diário
          <strong>{geracaoDiariaKwh.toFixed(1)} kWh</strong>
        </span>
      </div>
    </section>
  )

  /**
   * Função utilitária para renderizar blocos do CRM com bastante comentários e clareza.
   * Isso nos permite reutilizar a estrutura em diferentes seções (funcionalidades,
   * blueprint e camadas financeiras) sem duplicar JSX complexo.
   */
  const renderCrmBlocks = useCallback(
    (blocks: CrmContentBlock[]) =>
      blocks.map((block) => (
        <article key={block.id} className="card crm-card">
          <h3>{block.title}</h3>
          <p className="crm-description">{block.description}</p>
          <ul className="crm-list">
            {block.points.map((point, index) => (
              <li key={`${block.id}-point-${index}`}>{point}</li>
            ))}
          </ul>
          {block.automationHighlights ? (
            <div className="crm-subsection">
              <h4>Automações em destaque</h4>
              <ul className="crm-sublist">
                {block.automationHighlights.map((automation, index) => (
                  <li key={`${block.id}-automation-${index}`}>{automation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      )),
    [],
  )

  if (isCrmPage) {
    return (
      <div className="page">
        <header className="topbar app-header">
          <div className="brand">
            <img src="/logo.svg" alt="SolarInvest" />
            <div className="brand-text">
              <h1>SolarInvest App</h1>
              <p>CRM Gestão de Relacionamento e Operações</p>
            </div>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={handleVoltarParaProposta}>Voltar para proposta financeira</button>
          </div>
        </header>
        <div className="crm-main">
          <main className="crm-content">
            {crmBackendStatus === 'loading' ? (
              <div className="crm-status-banner loading">Sincronizando dados do CRM...</div>
            ) : null}
            {crmBackendStatus === 'success' && crmIntegrationMode === 'remote' ? (
              <div className="crm-status-banner success">
                Conectado ao backend oficial{crmLastSyncTexto ? ` — última sincronização em ${crmLastSyncTexto}` : ''}.
              </div>
            ) : null}
            {crmBackendStatus === 'success' && crmIntegrationMode === 'local' ? (
              <div className="crm-status-banner info">
                Operando em modo local: dados salvos com segurança no navegador. Ao publicar em solarinvest.info, a
                sincronização é automática.
              </div>
            ) : null}
            {crmBackendStatus === 'error' ? (
              <div className="crm-status-banner error">
                Não foi possível sincronizar com o backend agora. {crmBackendError || 'Continuamos operando com os dados locais.'}
              </div>
            ) : null}
            {crmIsSaving ? (
              <div className="crm-status-banner saving">Enviando atualizações para o backend...</div>
            ) : null}

            <section className="card crm-section">
              <h2>Visão geral do CRM SolarInvest</h2>
              <p>
                O módulo de CRM conecta marketing, vendas, operações técnicas e financeiro em uma jornada digital única. Toda a
                operação funciona integralmente em ambiente local e, quando publicada, sincroniza automaticamente com o backend
                oficial.
              </p>
            </section>

            <section className="crm-section">
              <h2>Painel operacional</h2>
              <div className="crm-kpis">
                <article className="crm-kpi card">
                  <span className="crm-kpi-label">Leads ativos</span>
                  <strong>{crmKpis.totalLeads}</strong>
                  <small>Total de oportunidades monitoradas.</small>
                </article>
                <article className="crm-kpi card">
                  <span className="crm-kpi-label">Projetos fechados</span>
                  <strong>{crmKpis.leadsFechados}</strong>
                  <small>Contratos assinados e prontos para implantação.</small>
                </article>
                <article className="crm-kpi card">
                  <span className="crm-kpi-label">Receita recorrente</span>
                  <strong>{currency(crmKpis.receitaRecorrente)}</strong>
                  <small>Leasing em andamento ou aguardando ativação.</small>
                </article>
                <article className="crm-kpi card">
                  <span className="crm-kpi-label">Receita pontual</span>
                  <strong>{currency(crmKpis.receitaPontual)}</strong>
                  <small>Vendas diretas concluídas e faturadas.</small>
                </article>
                <article className="crm-kpi card">
                  <span className="crm-kpi-label">Leads em risco</span>
                  <strong>{crmKpis.leadsEmRisco}</strong>
                  <small>Sem contato há mais de 3 dias em negociação.</small>
                </article>
              </div>
            </section>

            <section className="crm-section">
              <div className="card crm-filters">
                <h2>Filtros rápidos</h2>
                <div className="crm-filters-grid">
                  <label className="crm-filter-item">
                    <span>Buscar lead</span>
                    <input
                      type="search"
                      value={crmBusca}
                      placeholder="Nome, cidade, imóvel ou telefone"
                      onChange={(event) => setCrmBusca(event.target.value)}
                    />
                  </label>
                  <label className="crm-filter-item">
                    <span>Tipo de operação</span>
                    <select
                      value={crmFiltroOperacao}
                      onChange={(event) => setCrmFiltroOperacao(event.target.value as 'all' | CrmOperacao)}
                    >
                      <option value="all">Todos</option>
                      <option value="LEASING">Leasing</option>
                      <option value="VENDA_DIRETA">Venda direta</option>
                    </select>
                  </label>
                  <div className="crm-filter-item resumo">
                    <span>Leads filtrados</span>
                    <strong>{crmLeadsFiltrados.length}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="crm-section">
              <h2>Funil de vendas em tempo real</h2>
              <p className="crm-description">
                Atualize cada lead conforme avança no processo comercial. As mudanças ficam registradas na linha do tempo para
                auditoria completa.
              </p>
              <div className="crm-board">
                {CRM_PIPELINE_STAGES.map((stage, index) => {
                  const leadsDaEtapa = crmLeadsPorEtapa[stage.id]
                  return (
                    <article key={stage.id} className="crm-column card">
                      <header className="crm-column-header">
                        <div>
                          <h3>{stage.label}</h3>
                          <p>{stage.description}</p>
                        </div>
                        <span className="pill">{leadsDaEtapa.length} leads</span>
                      </header>
                      <div className="crm-column-body">
                        {leadsDaEtapa.length === 0 ? (
                          <p className="crm-column-empty">Nenhum lead nesta etapa.</p>
                        ) : (
                          leadsDaEtapa.map((lead) => {
                            const diasSemContato = diasDesdeDataIso(lead.ultimoContatoIso)
                            const isPrimeiraEtapa = index === 0
                            const isUltimaEtapa = index === CRM_PIPELINE_STAGES.length - 1
                            const emRisco = diasSemContato >= 3 && index <= CRM_STAGE_INDEX['negociacao']

                            return (
                              <div
                                key={lead.id}
                                className={`crm-lead-card${crmLeadSelecionadoId === lead.id ? ' selected' : ''}${
                                  emRisco ? ' risk' : ''
                                }`}
                              >
                                <button className="crm-lead-select" type="button" onClick={() => handleSelecionarLead(lead.id)}>
                                  <div>
                                    <h4>{lead.nome}</h4>
                                    <span className="crm-lead-location">
                                      {lead.cidade} • {lead.tipoImovel}
                                    </span>
                                  </div>
                                  <span className="crm-lead-value">{currency(lead.valorEstimado)}</span>
                                </button>
                                <p className="crm-lead-meta">Origem: {lead.origemLead}</p>
                                <p className="crm-lead-meta">
                                  Consumo estimado: <strong>{lead.consumoKwhMes} kWh/mês</strong>
                                </p>
                                <p className="crm-lead-meta">
                                  Operação: {lead.tipoOperacao === 'LEASING' ? 'Leasing' : 'Venda direta'} • Interesse:{' '}
                                  {lead.interesse}
                                </p>
                                <p className="crm-lead-meta">
                                  Último contato: {formatarDataCurta(lead.ultimoContatoIso)}{' '}
                                  {Number.isFinite(diasSemContato) ? `(${diasSemContato} dias)` : ''}
                                </p>
                                <div className="crm-lead-actions">
                                  <button type="button" onClick={() => handleMoverLead(lead.id, -1)} disabled={isPrimeiraEtapa}>
                                    ◀ Retornar
                                  </button>
                                  <button type="button" onClick={() => handleMoverLead(lead.id, 1)} disabled={isUltimaEtapa}>
                                    Avançar ▶
                                  </button>
                                  <button type="button" onClick={() => handleRemoverLead(lead.id)} className="danger">
                                    Remover
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="crm-section">
              <div className="crm-detail-grid">
                <article className="card crm-detail">
                  <h2>Lead selecionado</h2>
                  {crmLeadSelecionado ? (
                    <>
                      <p className="crm-description">
                        Todas as interações ficam registradas abaixo. Você pode complementar com notas internas e manter o
                        registro sempre atualizado para o time técnico e financeiro.
                      </p>
                      <ul className="crm-detail-list">
                        <li>
                          <strong>Contato:</strong> {crmLeadSelecionado.telefone}
                          {crmLeadSelecionado.email ? ` • ${crmLeadSelecionado.email}` : ''}
                        </li>
                        <li>
                          <strong>Origem:</strong> {crmLeadSelecionado.origemLead}
                        </li>
                        <li>
                          <strong>Interesse:</strong> {crmLeadSelecionado.interesse}
                        </li>
                        <li>
                          <strong>Valor estimado:</strong> {currency(crmLeadSelecionado.valorEstimado)}
                        </li>
                        <li>
                          <strong>Última atualização:</strong> {formatarDataCurta(crmLeadSelecionado.ultimoContatoIso)}
                        </li>
                      </ul>
                      <div className="crm-note-form">
                        <label>
                          <span>Registrar nota para este lead</span>
                          <textarea
                            value={crmNotaTexto}
                            onChange={(event) => setCrmNotaTexto(event.target.value)}
                            rows={4}
                            placeholder="Resumo da ligação, próximos passos ou decisões de financiamento"
                          />
                        </label>
                        <button type="button" className="primary" onClick={handleAdicionarNotaCrm}>
                          Salvar nota
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="crm-description">Selecione um lead no funil para visualizar detalhes e adicionar notas.</p>
                  )}
                </article>
                <article className="card crm-timeline">
                  <h2>Linha do tempo de atividades</h2>
                  <ul>
                    {crmTimelineFiltrada.length === 0 ? (
                      <li className="crm-timeline-empty">Sem registros ainda — mova um lead ou adicione uma nota.</li>
                    ) : (
                      crmTimelineFiltrada.map((evento) => (
                        <li key={evento.id}>
                          <div className="crm-timeline-meta">
                            <span className={`crm-timeline-tag ${evento.tipo}`}>{evento.tipo === 'anotacao' ? 'Nota' : evento.tipo === 'financeiro' ? 'Financeiro' : 'Status'}</span>
                            <span className="crm-timeline-date">{formatarDataCurta(evento.criadoEmIso)}</span>
                          </div>
                          <p>{evento.mensagem}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              </div>
            </section>

            <section className="crm-section">
              <article className="card crm-form">
                <h2>Adicionar novo lead</h2>
                <p className="crm-description">
                  Cadastre leads manualmente em ambiente local ou em produção. A integração identifica automaticamente o modo
                  atual e garante que nada se perca.
                </p>
                <form onSubmit={handleCrmLeadFormSubmit} className="crm-form-grid">
                  <label>
                    <span>Nome completo *</span>
                    <input
                      type="text"
                      value={crmLeadForm.nome}
                      onChange={(event) => handleCrmLeadFormChange('nome', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Telefone *</span>
                    <input
                      type="tel"
                      value={crmLeadForm.telefone}
                      onChange={(event) => handleCrmLeadFormChange('telefone', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input
                      type="email"
                      value={crmLeadForm.email}
                      onChange={(event) => handleCrmLeadFormChange('email', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Cidade *</span>
                    <input
                      type="text"
                      value={crmLeadForm.cidade}
                      onChange={(event) => handleCrmLeadFormChange('cidade', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Tipo de imóvel</span>
                    <input
                      type="text"
                      value={crmLeadForm.tipoImovel}
                      onChange={(event) => handleCrmLeadFormChange('tipoImovel', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Consumo mensal (kWh) *</span>
                    <input
                      type="number"
                      min={1}
                      value={crmLeadForm.consumoKwhMes}
                      onChange={(event) => handleCrmLeadFormChange('consumoKwhMes', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Origem do lead</span>
                    <input
                      type="text"
                      value={crmLeadForm.origemLead}
                      onChange={(event) => handleCrmLeadFormChange('origemLead', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Interesse</span>
                    <select
                      value={crmLeadForm.interesse}
                      onChange={(event) => handleCrmLeadFormChange('interesse', event.target.value as CrmLeadInterest)}
                    >
                      <option value="ON_GRID">On-grid</option>
                      <option value="OFF_GRID">Off-grid</option>
                      <option value="CONDIMINIO">Condomínio</option>
                      <option value="COMERCIAL">Comercial / Industrial</option>
                    </select>
                  </label>
                  <label>
                    <span>Tipo de operação</span>
                    <select
                      value={crmLeadForm.tipoOperacao}
                      onChange={(event) => handleCrmLeadFormChange('tipoOperacao', event.target.value as CrmOperacao)}
                    >
                      <option value="LEASING">Leasing</option>
                      <option value="VENDA_DIRETA">Venda direta</option>
                    </select>
                  </label>
                  <label>
                    <span>Valor estimado (R$) *</span>
                    <input
                      type="number"
                      min={0}
                      value={crmLeadForm.valorEstimado}
                      onChange={(event) => handleCrmLeadFormChange('valorEstimado', event.target.value)}
                      required
                    />
                  </label>
                  <label className="full-width">
                    <span>Observações iniciais</span>
                    <textarea
                      value={crmLeadForm.notas}
                      onChange={(event) => handleCrmLeadFormChange('notas', event.target.value)}
                      rows={3}
                    />
                  </label>
                  <div className="crm-form-actions">
                    <button type="submit" className="primary">
                      Cadastrar lead
                    </button>
                  </div>
                </form>
              </article>
            </section>

            <section className="crm-section">
              <h2>Funcionalidades principais</h2>
              <div className="crm-grid">{renderCrmBlocks(CRM_FEATURE_SECTIONS)}</div>
            </section>

            <section className="crm-section">
              <h2>Blueprint operacional detalhado</h2>
              <p className="crm-description">
                Cada etapa abaixo mapeia exatamente como o CRM deve funcionar, desde a captação até a inteligência analítica.
              </p>
              <div className="crm-grid">{renderCrmBlocks(CRM_BLUEPRINT_BLOCKS)}</div>
            </section>

            <section className="crm-section">
              <h2>Camadas financeiras e previsões</h2>
              <p className="crm-description">
                O CRM incorpora fluxos financeiros robustos para lidar com leasing, vendas diretas e projeções de caixa em tempo real.
              </p>
              <div className="crm-grid">{renderCrmBlocks(CRM_FINANCIAL_LAYERS)}</div>
            </section>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PrintableProposal ref={printableRef} {...printableData} />
      <header className="topbar app-header">
        <div className="brand">
          <img src="/logo.svg" alt="SolarInvest" />
          <div className="brand-text">
            <h1>SolarInvest App</h1>
            <p>Proposta financeira interativa</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={abrirPesquisaOrcamentos}>Pesquisar orçamentos</button>
          <button className="ghost" onClick={handleAbrirCrm}>CRM</button>
          <button className="ghost" onClick={handlePrint}>Exportar Proposta (PDF)</button>
          <button className="icon" onClick={() => setIsSettingsOpen(true)} aria-label="Abrir configurações">⚙︎</button>
        </div>
      </header>
      <div className="app-main">
        <nav className="tabs tabs-bar">
          <button className={activeTab === 'cliente' ? 'active' : ''} onClick={() => setActiveTab('cliente')}>
            Clientes
          </button>
          <button className={activeTab === 'leasing' ? 'active' : ''} onClick={() => setActiveTab('leasing')}>Leasing</button>
          <button className={activeTab === 'vendas' ? 'active' : ''} onClick={() => setActiveTab('vendas')}>Vendas</button>
          <button
            className={activeTab === 'financiamento' ? 'active' : ''}
            onClick={() => setActiveTab('financiamento')}
          >
            Financiamento
          </button>
        </nav>

        <main className="content page-content">
          {activeTab === 'leasing' ? (
            <>
            {renderParametrosPrincipaisSection()}
            {renderConfiguracaoUsinaSection()}
            <section className="card">
              <div className="card-header">
                <h2>SolarInvest Leasing</h2>
              </div>

              <div className="grid g2">
                <Field label="Entrada (R$)">
                  <input
                    type="number"
                    value={entradaRs}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setEntradaRs(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>

              <div className="info-inline">
                <span className="pill">
                  <InfoTooltip text="Tarifa com desconto = Tarifa cheia ajustada pelos reajustes anuais × (1 - desconto contratual)." />
                  Tarifa c/ desconto
                  <strong>{tarifaCurrency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
                </span>
                {modoEntradaNormalizado === 'REDUZ' ? (
                  <span className="pill">
                    Piso contratado ajustado
                    <InfoTooltip text="Piso ajustado = Consumo contratado × (1 - min(1, Entrada ÷ (Consumo × Tarifa cheia × (1 - desconto) × Prazo)))." />
                    :{' '}
                    <strong>
                      {`${parcelasSolarInvest.kcAjustado.toLocaleString('pt-BR', {
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0,
                      })} kWh`}
                    </strong>
                  </span>
                ) : null}
                {modoEntradaNormalizado === 'CREDITO' ? (
                  <span className="pill">
                    Crédito mensal da entrada:
                    <InfoTooltip text="Crédito mensal = Valor de entrada ÷ Prazo contratual (em meses)." />
                    <strong>{currency(parcelasSolarInvest.creditoMensal)}</strong>
                  </span>
                ) : null}
              </div>

              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaParcelas((prev) => !prev)}
                  aria-expanded={mostrarTabelaParcelas}
                  aria-controls="parcelas-solarinvest-tabela"
                >
                  {mostrarTabelaParcelas ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                </button>
              </div>
              {mostrarTabelaParcelas ? (
                <div className="table-wrapper">
                  <table id="parcelas-solarinvest-tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Tarifa projetada (R$/kWh)</th>
                        <th>Tarifa c/ desconto (R$/kWh)</th>
                        <th>MENSALIDADE CHEIA</th>
                        <th>MENSALIDADE COM LEASING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{tarifaCurrency(row.tarifaCheia)}</td>
                            <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                            <td>{currency(row.mensalidadeCheia)}</td>
                            <td>{currency(row.mensalidade)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <div className="grid g2">
              <section className="card">
                <h2>Leasing — Mensalidade</h2>
                <div className="list-col">
                  {leasingMensalidades.map((valor, index) => (
                    <div className="list-row" key={`leasing-m${index}`}>
                      <span>Ano {index + 1}</span>
                      <strong>{currency(valor)}</strong>
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <div className="dot" />
                  <div>
                    <p className="notice-title">Fim do prazo</p>
                    <p className="notice-sub">Após {leasingPrazo} anos a curva acelera: 100% do retorno fica com o cliente.</p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <h2>Financiamento — Mensalidade</h2>
                  <span className="toggle-label">Coluna ativa: {mostrarFinanciamento ? 'Sim' : 'Não'}</span>
                </div>
                {mostrarFinanciamento ? (
                  <div className="list-col">
                    {financiamentoMensalidades.map((valor, index) => (
                      <div className="list-row" key={`fin-m${index}`}>
                        <span>Ano {index + 1}</span>
                        <strong>{currency(valor)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Habilite nas configurações para comparar a coluna de financiamento.</p>
                )}
              </section>
            </div>

            <section className="card">
              <div className="card-header">
                <h2>Compra antecipada (Buyout)</h2>
                <span className="muted">Valores entre o mês 7 e o mês {duracaoMesesExibicao}.</span>
              </div>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaBuyout((prev) => !prev)}
                  aria-expanded={mostrarTabelaBuyout}
                  aria-controls="compra-antecipada-tabela"
                >
                  {mostrarTabelaBuyout ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                </button>
              </div>
              {mostrarTabelaBuyout ? (
                <div className="table-wrapper">
                  <table id="compra-antecipada-tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Tarifa projetada</th>
                        <th>Prestação efetiva</th>
                        <th>Cashback</th>
                        <th>Valor de compra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabelaBuyout
                        .filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada)
                        .map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{tarifaCurrency(row.tarifa)}</td>
                            <td>{currency(row.prestacaoEfetiva)}</td>
                            <td>{currency(row.cashback)}</td>
                            <td>{row.valorResidual === null ? '—' : currency(row.valorResidual)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
            {mostrarGrafico ? (
              <section className="card">
                <div className="card-header">
                  <h2>Beneficio acumulado em 30 anos</h2>
                  <div className="legend-toggle">
                    <label>
                      <input type="checkbox" checked={exibirLeasingLinha} onChange={(e) => setExibirLeasingLinha(e.target.checked)} />
                      <span style={{ color: chartColors.Leasing }}>Leasing</span>
                    </label>
                    {mostrarFinanciamento ? (
                      <label>
                        <input type="checkbox" checked={exibirFinLinha} onChange={(e) => setExibirFinLinha(e.target.checked)} />
                        <span style={{ color: chartColors.Financiamento }}>Financiamento</span>
                      </label>
                    ) : null}
                  </div>
                </div>
                <div className="chart">
                  {!allCurvesHidden ? (
                    <div className="chart-explainer">
                      <strong>ROI Leasing – Benefício financeiro</strong>
                      <span>Economia acumulada versus concessionária.</span>
                      {beneficioAno30 ? (
                        <span className="chart-highlight">
                          Beneficio acumulado em 30 anos:
                          <strong style={{ color: chartColors.Leasing }}> {currency(beneficioAno30.Leasing)}</strong>
                          {mostrarFinanciamento && exibirFinLinha ? (
                            <>
                              {' • '}Financiamento:{' '}
                              <strong style={{ color: chartColors.Financiamento }}>{currency(beneficioAno30.Financiamento)}</strong>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ano" stroke="#9CA3AF" label={{ value: 'Anos', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }} />
                      <YAxis stroke="#9CA3AF" tickFormatter={formatAxis} domain={yDomain} width={92} />
                      <Tooltip formatter={(value: number) => currency(Number(value))} contentStyle={{ background: '#0b1220', border: '1px solid #1f2b40' }} />
                      <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16 }} />
                      <ReferenceLine y={0} stroke="#475569" />
                      {exibirLeasingLinha ? <Line type="monotone" dataKey="Leasing" stroke={chartColors.Leasing} strokeWidth={2} dot /> : null}
                      {mostrarFinanciamento && exibirFinLinha ? (
                        <Line type="monotone" dataKey="Financiamento" stroke={chartColors.Financiamento} strokeWidth={2} dot />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </>
        ) : activeTab === 'cliente' ? (
          <section className="card">
            <div className="card-header">
              <h2>Dados do cliente</h2>
            </div>
            <div className="grid g2">
              <Field label="Nome ou Razão social">
                <input value={cliente.nome} onChange={(e) => handleClienteChange('nome', e.target.value)} />
              </Field>
              <Field label="CPF/CNPJ">
                <input
                  value={cliente.documento}
                  onChange={(e) => handleClienteChange('documento', e.target.value)}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="E-mail" hint={clienteMensagens.email}>
                <input
                  value={cliente.email}
                  onChange={(e) => handleClienteChange('email', e.target.value)}
                  type="email"
                  placeholder="nome@empresa.com"
                />
              </Field>
              <Field label="Telefone">
                <input value={cliente.telefone} onChange={(e) => handleClienteChange('telefone', e.target.value)} />
              </Field>
              <Field label="Distribuidora">
                <input value={cliente.distribuidora} onChange={(e) => handleClienteChange('distribuidora', e.target.value)} />
              </Field>
              <Field label="Unidade consumidora (UC)">
                <input value={cliente.uc} onChange={(e) => handleClienteChange('uc', e.target.value)} />
              </Field>
              <Field label="Endereço">
                <input value={cliente.endereco} onChange={(e) => handleClienteChange('endereco', e.target.value)} />
              </Field>
              <Field
                label="Cidade"
                hint={
                  verificandoCidade
                    ? 'Verificando cidade...'
                    : clienteMensagens.cidade
                }
              >
                <input value={cliente.cidade} onChange={(e) => handleClienteChange('cidade', e.target.value)} />
              </Field>
              <Field label="UF ou Estado">
                <select value={cliente.uf} onChange={(e) => handleClienteChange('uf', e.target.value)}>
                  <option value="">Selecione um estado</option>
                  {ESTADOS_BRASILEIROS.map(({ sigla, nome }) => (
                    <option key={sigla} value={sigla}>
                      {nome} ({sigla})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="card-actions">
              <button type="button" className="primary" onClick={handleSalvarCliente}>
                {clienteEmEdicaoId ? 'Atualizar cliente' : 'Salvar cliente'}
              </button>
              <button type="button" className="ghost" onClick={abrirClientesModal}>
                Ver clientes
              </button>
            </div>
          </section>
        ) : activeTab === 'financiamento' ? (
          <>
            {renderParametrosPrincipaisSection()}
            {renderConfiguracaoUsinaSection()}
            <section className="card">
              <h2>Resumo do financiamento</h2>
              {mostrarFinanciamento ? (
                <div className="info-inline">
                  <span className="pill">
                    Investimento da SolarInvest
                    <strong>{currency(capex)}</strong>
                  </span>
                  <span className="pill">
                    Entrada ({entradaFinPct.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%)
                    <strong>{currency(entradaFin)}</strong>
                  </span>
                  <span className="pill">
                    Valor financiado
                    <strong>{currency(valorFinanciado)}</strong>
                  </span>
                  <span className="pill">
                    Parcela mensal
                    <strong>{currency(parcelaMensalFin)}</strong>
                  </span>
                  <span className="pill">
                    Prazo do financiamento
                    <strong>
                      {Math.max(prazoFinMeses, 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                      meses
                    </strong>
                  </span>
                  <span className="pill">
                    Juros a.a.
                    <strong>
                      {jurosFinAa.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}%
                    </strong>
                  </span>
                  <span className="pill">
                    Juros a.m.
                    <strong>
                      {taxaMensalFinPct.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}%
                    </strong>
                  </span>
                  {beneficioAno30 ? (
                    <span className="pill">
                      Benefício em 30 anos
                      <strong>{currency(beneficioAno30.Financiamento)}</strong>
                    </span>
                  ) : null}
                  <span className="pill">
                    Total pago (entrada + parcelas)
                    <strong>{currency(totalPagoFinanciamento)}</strong>
                  </span>
                </div>
              ) : (
                <p className="muted">Habilite nas configurações para visualizar os cenários de financiamento.</p>
              )}
            </section>
            {mostrarFinanciamento ? (
              <>
                <div className="grid g2">
                  <section className="card">
                    <h2>Mensalidades previstas</h2>
                    {financiamentoMensalidades.length > 0 ? (
                      <div className="list-col">
                        {financiamentoMensalidades.map((valor, index) => (
                          <div className="list-row" key={`fin-tab-m${index}`}>
                            <span>Ano {index + 1}</span>
                            <strong>{currency(valor)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">Defina um prazo para calcular as mensalidades do financiamento.</p>
                    )}
                  </section>
                  <section className="card">
                    <h2>Fluxo anual projetado</h2>
                    <div className="list-col">
                      {anosArray.map((ano) => (
                        <div className="list-row" key={`fin-fluxo-${ano}`}>
                          <span>Ano {ano}</span>
                          <strong>{currency(financiamentoFluxo[ano - 1] ?? 0)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <section className="card">
                  <h2>Benefício acumulado</h2>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Ano</th>
                          <th>Fluxo anual</th>
                          <th>Benefício acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anosArray.map((ano) => (
                          <tr key={`fin-tabela-${ano}`}>
                            <td>{ano}</td>
                            <td>{currency(financiamentoFluxo[ano - 1] ?? 0)}</td>
                            <td>{currency(financiamentoROI[ano - 1] ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : (
          <>
            {renderParametrosPrincipaisSection()}
            {renderConfiguracaoUsinaSection()}
            <section className="card">
              <h2>Vendas</h2>
              <p className="muted">Área de Vendas em desenvolvimento.</p>
            </section>
          </>
        )}
        </main>
      </div>

      {isClientesModalOpen ? (
        <ClientesModal
          registros={clientesSalvos}
          onClose={fecharClientesModal}
          onEditar={handleEditarCliente}
          onExcluir={handleExcluirCliente}
        />
      ) : null}

      {isBudgetSearchOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="budget-search-title">
          <div className="modal-backdrop" onClick={fecharPesquisaOrcamentos} />
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="budget-search-title">Pesquisar orçamentos</h3>
              <button
                className="icon"
                onClick={fecharPesquisaOrcamentos}
                aria-label="Fechar pesquisa de orçamentos"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <section className="budget-search-panel">
                <div className="budget-search-header">
                  <h4>Consulta rápida</h4>
                  <p>Localize propostas salvas pelo CPF, nome, UC ou código do orçamento.</p>
                </div>
                <Field
                  label="Buscar orçamentos"
                  hint="Procure por CPF, nome, unidade consumidora ou código do orçamento."
                >
                  <input
                    id="budget-search-input"
                    type="search"
                    value={orcamentoSearchTerm}
                    onChange={(e) => setOrcamentoSearchTerm(e.target.value)}
                    placeholder="Ex.: 123.456.789-00 ou ORC-ABCD-123456"
                    autoFocus
                  />
                </Field>
                <div className="budget-search-summary">
                  <span>
                    {totalOrcamentos === 0
                      ? 'Nenhum orçamento salvo até o momento.'
                      : `${totalResultados} de ${totalOrcamentos} orçamento(s) exibidos.`}
                  </span>
                  {orcamentoSearchTerm ? (
                    <button type="button" className="link" onClick={() => setOrcamentoSearchTerm('')}>
                      Limpar busca
                    </button>
                  ) : null}
                </div>
              </section>
              <section className="budget-search-panel">
                <div className="budget-search-header">
                  <h4>Registros salvos</h4>
                </div>
                {totalOrcamentos === 0 ? (
                  <p className="budget-search-empty">
                    Nenhum orçamento foi salvo ainda. Gere uma proposta para começar.
                  </p>
                ) : totalResultados === 0 ? (
                  <p className="budget-search-empty">
                    Nenhum orçamento encontrado para "<strong>{orcamentoSearchTerm}</strong>".
                  </p>
                ) : (
                  <div className="budget-search-table">
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Cliente</th>
                            <th>Documento</th>
                            <th>Unidade consumidora</th>
                            <th>Criado em</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orcamentosFiltrados.map((registro) => {
                            const documento = registro.clienteDocumento || registro.dados.cliente.documento || ''
                            const unidadeConsumidora = registro.clienteUc || registro.dados.cliente.uc || ''
                            const cidade = registro.clienteCidade || registro.dados.cliente.cidade || ''
                            const uf = registro.clienteUf || registro.dados.cliente.uf || ''
                            return (
                              <tr key={registro.id}>
                                <td>{registro.id}</td>
                                <td>
                                  <div className="budget-search-client">
                                    <strong>{registro.clienteNome || registro.dados.cliente.nome || '—'}</strong>
                                    <span>
                                      {cidade ? `${cidade} / ${uf || '—'}` : uf || '—'}
                                    </span>
                                  </div>
                                </td>
                                <td>{documento || '—'}</td>
                                <td>{unidadeConsumidora || '—'}</td>
                                <td>{formatBudgetDate(registro.criadoEm)}</td>
                                <td>
                                  <div className="budget-search-actions">
                                    <button
                                      type="button"
                                      className="budget-search-action"
                                      onClick={() => abrirOrcamentoSalvo(registro, 'preview')}
                                      aria-label="Visualizar orçamento salvo"
                                      title="Visualizar orçamento"
                                    >
                                      👁
                                    </button>
                                    <button
                                      type="button"
                                      className="budget-search-action"
                                      onClick={() => abrirOrcamentoSalvo(registro, 'download')}
                                      aria-label="Baixar orçamento em PDF"
                                      title="Baixar PDF"
                                    >
                                      ⤓
                                    </button>
                                    <button
                                      type="button"
                                      className="budget-search-action danger"
                                      onClick={() => confirmarRemocaoOrcamento(registro)}
                                      aria-label="Excluir orçamento salvo"
                                      title="Excluir orçamento salvo"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configurações</h3>
              <button className="icon" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="settings-tabs">
                <nav
                  className="settings-tabs-nav"
                  role="tablist"
                  aria-label="Configurações da simulação"
                >
                  {SETTINGS_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`settings-tab${settingsTab === tab.id ? ' active' : ''}`}
                      role="tab"
                      id={`settings-tab-${tab.id}`}
                      aria-selected={settingsTab === tab.id}
                      aria-controls={`settings-panel-${tab.id}`}
                      onClick={() => setSettingsTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="settings-panels">
                  <section
                    id="settings-panel-mercado"
                    role="tabpanel"
                    aria-labelledby="settings-tab-mercado"
                    className={`settings-panel${settingsTab === 'mercado' ? ' active' : ''}`}
                    hidden={settingsTab !== 'mercado'}
                    aria-hidden={settingsTab !== 'mercado'}
                  >
                    <div className="settings-panel-header">
                      <h4>Mercado & energia</h4>
                      <p className="settings-panel-description">
                        Ajuste as premissas macroeconômicas da projeção.
                      </p>
                    </div>
                    <div className="grid g2">
                      <Field label="Inflação energética (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={inflacaoAa}
                          onChange={(e) => setInflacaoAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Preço por kWp (R$)">
                        <input
                          type="number"
                          value={precoPorKwp}
                          onChange={(e) => setPrecoPorKwp(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Irradiação média (kWh/m²/dia)">
                        <input
                          type="number"
                          step="0.1"
                          min={0.01}
                          value={irradiacao}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setIrradiacao(Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Eficiência do sistema">
                        <input
                          type="number"
                          step="0.01"
                          min={0.01}
                          value={eficiencia}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              setEficiencia(0)
                              return
                            }
                            handleEficienciaInput(Number(e.target.value))
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Dias no mês (cálculo)">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={diasMes > 0 ? diasMes : ''}
                          onChange={(e) => {
                            const { value } = e.target
                            if (value === '') {
                              setDiasMes(0)
                              return
                            }
                            const parsed = Number(value)
                            setDiasMes(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                  </section>
                  <section
                    id="settings-panel-leasing"
                    role="tabpanel"
                    aria-labelledby="settings-tab-leasing"
                    className={`settings-panel${settingsTab === 'leasing' ? ' active' : ''}`}
                    hidden={settingsTab !== 'leasing'}
                    aria-hidden={settingsTab !== 'leasing'}
                  >
                    <div className="settings-panel-header">
                      <h4>Leasing parâmetros</h4>
                      <p className="settings-panel-description">
                        Personalize as condições do contrato de leasing.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field label="Prazo contratual (meses)">
                        <input
                          type="number"
                          min={1}
                          value={prazoMeses}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setPrazoMeses(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Bandeira tarifária (R$)">
                        <input
                          type="number"
                          value={bandeiraEncargo}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setBandeiraEncargo(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Contribuição CIP (R$)">
                        <input
                          type="number"
                          value={cipEncargo}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setCipEncargo(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Uso da entrada">
                        <select value={entradaModo} onChange={(e) => setEntradaModo(e.target.value as EntradaModoLabel)}>
                          <option value="Crédito mensal">Crédito mensal</option>
                          <option value="Reduz piso contratado">Reduz piso contratado</option>
                        </select>
                      </Field>
                    </div>
                    <div className="info-inline">
                      <span className="pill">
                        Margem mínima: <strong>{currency(parcelasSolarInvest.margemMinima)}</strong>
                      </span>
                      <span className="pill">
                        Total pago no prazo: <strong>{currency(parcelasSolarInvest.totalPago)}</strong>
                      </span>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Parcelas — Total pago acumulado</p>
                      <div className="table-controls">
                        <button
                          type="button"
                          className="collapse-toggle"
                          onClick={() => setMostrarTabelaParcelasConfig((prev) => !prev)}
                          aria-expanded={mostrarTabelaParcelasConfig}
                          aria-controls="config-parcelas-total"
                        >
                          {mostrarTabelaParcelasConfig ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                        </button>
                      </div>
                      {mostrarTabelaParcelasConfig ? (
                        <div className="table-wrapper">
                          <table id="config-parcelas-total">
                            <thead>
                              <tr>
                                <th>Mês</th>
                                <th>Total pago acumulado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parcelasSolarInvest.lista.length > 0 ? (
                                parcelasSolarInvest.lista.map((row) => (
                                  <tr key={`config-parcela-${row.mes}`}>
                                    <td>{row.mes}</td>
                                    <td>{currency(row.totalAcumulado)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <section
                    id="settings-panel-financiamento"
                    role="tabpanel"
                    aria-labelledby="settings-tab-financiamento"
                    className={`settings-panel${settingsTab === 'financiamento' ? ' active' : ''}`}
                    hidden={settingsTab !== 'financiamento'}
                    aria-hidden={settingsTab !== 'financiamento'}
                  >
                    <div className="settings-panel-header">
                      <h4>Financiamento parâmetros</h4>
                      <p className="settings-panel-description">
                        Defina as variáveis financeiras do cenário financiado.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field label="Juros a.a. (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={jurosFinAa}
                          onChange={(e) => setJurosFinAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Prazo (meses)">
                        <input
                          type="number"
                          value={prazoFinMeses}
                          onChange={(e) => setPrazoFinMeses(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Entrada (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={entradaFinPct}
                          onChange={(e) => setEntradaFinPct(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                  </section>
                  <section
                    id="settings-panel-buyout"
                    role="tabpanel"
                    aria-labelledby="settings-tab-buyout"
                    className={`settings-panel${settingsTab === 'buyout' ? ' active' : ''}`}
                    hidden={settingsTab !== 'buyout'}
                    aria-hidden={settingsTab !== 'buyout'}
                  >
                    <div className="settings-panel-header">
                      <h4>Buyout parâmetros</h4>
                      <p className="settings-panel-description">
                        Configure premissas de recompra e fluxo residual.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field label="Cashback (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={cashbackPct}
                          onChange={(e) => setCashbackPct(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Depreciação (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={depreciacaoAa}
                          onChange={(e) => setDepreciacaoAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Inadimplência (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={inadimplenciaAa}
                          onChange={(e) => setInadimplenciaAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Tributos (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={tributosAa}
                          onChange={(e) => setTributosAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="IPCA (%)">
                        <input
                          type="number"
                          step="0.1"
                          value={ipcaAa}
                          onChange={(e) => setIpcaAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Custos fixos (R$)">
                        <input
                          type="number"
                          value={custosFixosM}
                          onChange={(e) => setCustosFixosM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="OPEX (R$)">
                        <input
                          type="number"
                          value={opexM}
                          onChange={(e) => setOpexM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Seguro (R$)">
                        <input
                          type="number"
                          value={seguroM}
                          onChange={(e) => setSeguroM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Duração (meses)">
                        <input
                          type="number"
                          value={duracaoMeses}
                          onChange={(e) => setDuracaoMeses(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field label="Pagos acumulados até o mês (R$)">
                        <input
                          type="number"
                          value={pagosAcumAteM}
                          onChange={(e) => setPagosAcumAteM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Buyout — Receita acumulada</p>
                      <div className="table-controls">
                        <button
                          type="button"
                          className="collapse-toggle"
                          onClick={() => setMostrarTabelaBuyoutConfig((prev) => !prev)}
                          aria-expanded={mostrarTabelaBuyoutConfig}
                          aria-controls="config-buyout-receita"
                        >
                          {mostrarTabelaBuyoutConfig ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                        </button>
                      </div>
                      {mostrarTabelaBuyoutConfig ? (
                        <div className="table-wrapper">
                          <table id="config-buyout-receita">
                            <thead>
                              <tr>
                                <th>Mês</th>
                                <th>Receita acumulada</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buyoutReceitaRows.length > 0 ? (
                                buyoutReceitaRows.map((row) => (
                                  <tr key={`config-buyout-${row.mes}`}>
                                    <td>{row.mes}</td>
                                    <td>{currency(row.prestacaoAcum)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="muted">Defina os parâmetros para visualizar a receita acumulada.</td>
                                </tr>
                              )}
                              {buyoutAceiteFinal ? (
                                <tr>
                                  <td>{buyoutMesAceiteFinal}</td>
                                  <td>{currency(buyoutAceiteFinal.prestacaoAcum)}</td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <section
                    id="settings-panel-outros"
                    role="tabpanel"
                    aria-labelledby="settings-tab-outros"
                    className={`settings-panel${settingsTab === 'outros' ? ' active' : ''}`}
                    hidden={settingsTab !== 'outros'}
                    aria-hidden={settingsTab !== 'outros'}
                  >
                    <div className="settings-panel-header">
                      <h4>Outros</h4>
                      <p className="settings-panel-description">
                        Controles complementares de operação e apresentação.
                      </p>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">O&M e seguro</p>
                      <div className="grid g3">
                        <Field label="O&M base (R$/kWp)">
                          <input
                            type="number"
                            value={oemBase}
                            onChange={(e) => setOemBase(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field label="Reajuste O&M (%)">
                          <input
                            type="number"
                            step="0.1"
                            value={oemInflacao}
                            onChange={(e) => setOemInflacao(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field label="Reajuste seguro (%)">
                          <input
                            type="number"
                            step="0.1"
                            value={seguroReajuste}
                            onChange={(e) => setSeguroReajuste(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field label="Modo de seguro">
                          <select value={seguroModo} onChange={(e) => setSeguroModo(e.target.value as SeguroModo)}>
                            <option value="A">Modo A — Potência (R$)</option>
                            <option value="B">Modo B — % Valor de mercado</option>
                          </select>
                        </Field>
                        <Field label="Base seguro modo A (R$/kWp)">
                          <input
                            type="number"
                            value={seguroValorA}
                            onChange={(e) => setSeguroValorA(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field label="Seguro modo B (%)">
                          <input
                            type="number"
                            step="0.01"
                            value={seguroPercentualB}
                            onChange={(e) => setSeguroPercentualB(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Exibição</p>
                      <div className="grid g2">
                        <Field label="Mostrar gráfico ROI">
                          <select value={mostrarGrafico ? '1' : '0'} onChange={(e) => setMostrarGrafico(e.target.value === '1')}>
                            <option value="1">Sim</option>
                            <option value="0">Não</option>
                          </select>
                        </Field>
                        <Field label="Mostrar coluna financiamento">
                          <select value={mostrarFinanciamento ? '1' : '0'} onChange={(e) => setMostrarFinanciamento(e.target.value === '1')}>
                            <option value="1">Sim</option>
                            <option value="0">Não</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {notificacoes.length > 0 ? (
        <div className="toast-stack" role="region" aria-live="polite" aria-label="Notificações">
          {notificacoes.map((item) => (
            <div key={item.id} className={`toast-item ${item.tipo}`} role="status">
              <span className="toast-icon" aria-hidden="true">
                {iconeNotificacaoPorTipo[item.tipo]}
              </span>
              <span className="toast-message">{item.mensagem}</span>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => removerNotificacao(item.id)}
                aria-label="Dispensar notificação"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

