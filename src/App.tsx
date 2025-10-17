import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Label,
  BarChart,
  Bar,
  LabelList,
} from 'recharts'

import {
  selectCreditoMensal,
  selectInflacaoMensal,
  selectBuyoutLinhas,
  selectKcAjustado,
  selectMensalidades,
  selectTarifaDescontada,
  selectMensalidadesPorAno,
} from './selectors'
import type { SimulationState, BuyoutLinha } from './selectors'
import { tarifaDescontada as tarifaDescontadaCalc, tarifaProjetadaCheia } from './utils/calcs'
import type { EntradaModo } from './utils/calcs'
import { getIrradiacaoPorEstado, hasEstadoMinimo, IRRADIACAO_FALLBACK } from './utils/irradiacao'
import { getMesReajusteFromANEEL } from './utils/reajusteAneel'
import { getTarifaCheia } from './utils/tarifaAneel'
import { getDistribuidorasFallback, loadDistribuidorasAneel } from './utils/distribuidorasAneel'
import { selectNumberInputOnFocus } from './utils/focusHandlers'
import { persistClienteRegistroToOneDrive } from './utils/onedrive'
import type { ClienteRegistroSyncPayload } from './utils/onedrive'
import { persistProposalPdf } from './utils/proposalPdf'
import { extractBudgetFromPdf } from './utils/pdfBudgetExtractor'
import type { StructuredBudget } from './utils/structuredBudgetParser'
import { computeROI } from './lib/finance/roi'
import type {
  ModoPagamento,
  PagamentoCondicao,
  RetornoProjetado,
  VendaForm,
} from './lib/finance/roi'

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

const BENEFICIO_CHART_ANOS = [5, 6, 10, 15, 20, 30]

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

const formatCep = (valor: string) => {
  const numeros = normalizeNumbers(valor).slice(0, 8)
  if (!numeros) {
    return ''
  }

  if (numeros.length <= 5) {
    return numeros
  }

  return `${numeros.slice(0, 5)}-${numeros.slice(5)}`
}

const formatTelefone = (valor: string) => {
  const numeros = normalizeNumbers(valor).slice(0, 11)
  if (!numeros) {
    return ''
  }

  if (numeros.length <= 2) {
    return `(${numeros}${numeros.length === 2 ? ')' : ''}`
  }

  const ddd = numeros.slice(0, 2)
  const restante = numeros.slice(2)

  if (!restante) {
    return `(${ddd}`
  }

  if (restante.length <= 4) {
    return `(${ddd}) ${restante}`
  }

  if (restante.length <= 8) {
    const parte1 = restante.slice(0, 4)
    const parte2 = restante.slice(4)
    return parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`
  }

  const parte1 = restante.slice(0, 5)
  const parte2 = restante.slice(5)
  return `(${ddd}) ${parte1}-${parte2}`
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

type ViaCepResponse = {
  logradouro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
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

type ClienteDados = {
  nome: string
  documento: string
  email: string
  telefone: string
  cep: string
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

type ClienteMensagens = {
  email?: string
  cidade?: string
  cep?: string
}

type NotificacaoTipo = 'success' | 'info' | 'error'

type Notificacao = {
  id: number
  mensagem: string
  tipo: NotificacaoTipo
}

type BudgetTotalSource = 'explicit' | 'calculated' | null

type KitBudgetItemState = {
  id: string
  productName: string
  description: string
  quantity: number | null
  quantityInput: string
  unitPrice: number | null
  unitPriceInput: string
}

type KitBudgetState = {
  items: KitBudgetItemState[]
  total: number | null
  totalSource: BudgetTotalSource
  totalInput: string
  warnings: string[]
  fileName?: string
}

const formatQuantityInputValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }
  const normalized = value.toString()
  return normalized.includes('.') ? normalized.replace('.', ',') : normalized
}

const formatCurrencyInputValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const parseNumericInput = (value: string): number | null => {
  if (!value) {
    return null
  }
  const sanitized = value
    .replace(/\s+/g, '')
    .replace(/[Rr]\$/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  if (!sanitized || sanitized === '-' || sanitized === '.' || sanitized === ',') {
    return null
  }
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeCurrencyNumber = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100

const computeBudgetItemsTotalValue = (items: KitBudgetItemState[]): number | null => {
  if (!items.length) {
    return null
  }
  let total = 0
  for (const item of items) {
    if (item.quantity === null || item.unitPrice === null) {
      return null
    }
    total += item.quantity * item.unitPrice
  }
  return Math.round(total * 100) / 100
}

const computeBudgetItemLineTotal = (item: KitBudgetItemState): number | null => {
  if (item.quantity === null || item.unitPrice === null) {
    return null
  }
  return Math.round(item.quantity * item.unitPrice * 100) / 100
}

const numbersAreClose = (a: number | null, b: number | null, tolerance = 0.01) => {
  if (a === null && b === null) {
    return true
  }
  if (a === null || b === null) {
    return false
  }
  return Math.abs(a - b) <= tolerance
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

type CrmStageId =
  | 'novo-lead'
  | 'qualificacao'
  | 'proposta-enviada'
  | 'negociacao'
  | 'aguardando-contrato'
  | 'fechado'

type CrmPipelineStage = {
  id: CrmStageId
  label: string
}

type CrmTimelineEntryType = 'status' | 'anotacao'

type CrmTimelineEntry = {
  id: string
  leadId: string
  mensagem: string
  tipo: CrmTimelineEntryType
  criadoEmIso: string
}

type CrmLeadRecord = {
  id: string
  nome: string
  telefone: string
  email?: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: number
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: number
  etapa: CrmStageId
  ultimoContatoIso: string
  criadoEmIso: string
  notas?: string
  instalacaoStatus: 'planejamento' | 'em-andamento' | 'concluida' | 'aguardando-homologacao'
}

type CrmFinanceiroStatus = 'em-aberto' | 'ativo' | 'inadimplente' | 'quitado'

type CrmContratoFinanceiro = {
  id: string
  leadId: string
  modelo: 'LEASING' | 'VENDA_DIRETA'
  valorTotal: number
  entrada: number
  parcelas: number
  valorParcela: number
  reajusteAnualPct: number
  vencimentoInicialIso: string
  status: CrmFinanceiroStatus
}

type CrmLancamentoCaixa = {
  id: string
  leadId?: string
  dataIso: string
  categoria: 'Receita' | 'Custo Fixo' | 'Custo Variável' | 'Investimento'
  origem: string
  formaPagamento: 'Pix' | 'Boleto' | 'Cartão' | 'Transferência'
  tipo: 'entrada' | 'saida'
  valor: number
  observacao?: string
}

type CrmCustoProjeto = {
  id: string
  leadId: string
  equipamentos: number
  maoDeObra: number
  deslocamento: number
  taxasSeguros: number
}

type CrmManutencaoRegistro = {
  id: string
  leadId: string
  dataIso: string
  tipo: string
  status: 'pendente' | 'concluida'
  observacao?: string
}

type CrmDataset = {
  leads: CrmLeadRecord[]
  timeline: CrmTimelineEntry[]
  contratos: CrmContratoFinanceiro[]
  lancamentos: CrmLancamentoCaixa[]
  custos: CrmCustoProjeto[]
  manutencoes: CrmManutencaoRegistro[]
}

type CrmLeadFormState = {
  nome: string
  telefone: string
  email: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: string
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: string
  notas: string
}

type CrmIntegrationMode = 'local' | 'remote'
type CrmBackendStatus = 'idle' | 'success' | 'error'
type CrmFiltroOperacao = 'all' | 'LEASING' | 'VENDA_DIRETA'

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

type PrintableProposalTipo = 'LEASING' | 'VENDA_DIRETA'

type PrintableProps = {
  cliente: ClienteDados
  budgetId?: string
  anos: number[]
  leasingROI: number[]
  financiamentoFluxo: number[]
  financiamentoROI: number[]
  mostrarFinanciamento: boolean
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo
  capex: number
  tipoProposta: PrintableProposalTipo
  geracaoMensalKwh: number
  potenciaPlaca: number
  numeroPlacas: number
  potenciaInstaladaKwp: number
  tipoInstalacao: TipoInstalacao
  areaInstalacao: number
  descontoContratualPct: number
  parcelasLeasing: MensalidadeRow[]
  distribuidoraTarifa: string
  energiaContratadaKwh: number
  tarifaCheia: number
  vendaResumo?: {
    form: VendaForm
    retorno: RetornoProjetado | null
  }
}

type MensalidadeRow = {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
  mensalidadeCheia: number
  mensalidade: number
  totalAcumulado: number
}

type MensalidadeAnualRow = {
  ano: number
  tarifaCheiaMedia: number
  tarifaDescontadaMedia: number
  mensalidadeCheiaMedia: number
  mensalidadeMedia: number
}

type OrcamentoSalvo = {
  id: string
  criadoEm: string
  clienteId?: string
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
const CLIENTE_ID_LENGTH = 5
const CLIENTE_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CLIENTE_ID_PATTERN = /^[A-Z0-9]{5}$/
const CLIENTE_ID_MAX_ATTEMPTS = 10000

const CLIENTE_INICIAL: ClienteDados = {
  nome: '',
  documento: '',
  email: '',
  telefone: '',
  cep: '',
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
  budgetId: dados.budgetId,
  tipoProposta: dados.tipoProposta,
  cliente: { ...dados.cliente },
  anos: [...dados.anos],
  leasingROI: [...dados.leasingROI],
  financiamentoFluxo: [...dados.financiamentoFluxo],
  financiamentoROI: [...dados.financiamentoROI],
  tabelaBuyout: dados.tabelaBuyout.map((row) => ({ ...row })),
  buyoutResumo: { ...dados.buyoutResumo },
  parcelasLeasing: dados.parcelasLeasing.map((row) => ({ ...row })),
  energiaContratadaKwh: dados.energiaContratadaKwh,
  tarifaCheia: dados.tarifaCheia,
  vendaResumo: dados.vendaResumo
    ? {
        form: { ...dados.vendaResumo.form },
        retorno: dados.vendaResumo.retorno
          ? {
              ...dados.vendaResumo.retorno,
              economia: [...dados.vendaResumo.retorno.economia],
              pagamentoMensal: [...dados.vendaResumo.retorno.pagamentoMensal],
              fluxo: [...dados.vendaResumo.retorno.fluxo],
              saldo: [...dados.vendaResumo.retorno.saldo],
            }
          : null,
      }
    : undefined,
})

const cloneClienteDados = (dados: ClienteDados): ClienteDados => ({ ...dados })

const normalizeClienteIdCandidate = (valor: string | undefined | null) =>
  (valor ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const generateClienteId = (existingIds: Set<string> = new Set()) => {
  let attempts = 0

  while (attempts < CLIENTE_ID_MAX_ATTEMPTS) {
    attempts += 1
    let candidate = ''
    for (let index = 0; index < CLIENTE_ID_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * CLIENTE_ID_CHARSET.length)
      candidate += CLIENTE_ID_CHARSET[randomIndex]
    }

    if (!existingIds.has(candidate)) {
      existingIds.add(candidate)
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um identificador único para o cliente.')
}

const ensureClienteId = (candidate: string | undefined, existingIds: Set<string>) => {
  const normalized = normalizeClienteIdCandidate(candidate)
  if (normalized.length === CLIENTE_ID_LENGTH && CLIENTE_ID_PATTERN.test(normalized) && !existingIds.has(normalized)) {
    existingIds.add(normalized)
    return normalized
  }

  return generateClienteId(existingIds)
}

const CRM_LOCAL_STORAGE_KEY = 'solarinvest-crm-dataset'
const CRM_BACKEND_BASE_URL = 'https://crm.solarinvest.app'

const CRM_PIPELINE_STAGES: CrmPipelineStage[] = [
  { id: 'novo-lead', label: 'Novo lead' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'proposta-enviada', label: 'Proposta enviada' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'aguardando-contrato', label: 'Aguardando contrato' },
  { id: 'fechado', label: 'Fechado' },
]

const CRM_INSTALACAO_STATUS: { id: CrmLeadRecord['instalacaoStatus']; label: string }[] = [
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'em-andamento', label: 'Em andamento' },
  { id: 'aguardando-homologacao', label: 'Aguardando homologação' },
  { id: 'concluida', label: 'Concluída' },
]

const CRM_FINANCEIRO_CATEGORIAS: CrmLancamentoCaixa['categoria'][] = [
  'Receita',
  'Custo Fixo',
  'Custo Variável',
  'Investimento',
]

const CRM_FORMAS_PAGAMENTO: CrmLancamentoCaixa['formaPagamento'][] = [
  'Pix',
  'Boleto',
  'Cartão',
  'Transferência',
]

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
  interesse: 'Leasing',
  tipoOperacao: 'LEASING',
  valorEstimado: '',
  notas: '',
}

const CRM_DATASET_VAZIO: CrmDataset = {
  leads: [],
  timeline: [],
  contratos: [],
  lancamentos: [],
  custos: [],
  manutencoes: [],
}

const gerarIdCrm = (
  prefixo: 'lead' | 'evento' | 'contrato' | 'lancamento' | 'custo' | 'manutencao',
) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefixo}-${crypto.randomUUID()}`
  }

  const aleatorio = Math.floor(Math.random() * 1_000_000)
  return `${prefixo}-${Date.now()}-${aleatorio.toString().padStart(6, '0')}`
}

const diasDesdeDataIso = (isoString: string) => {
  const data = new Date(isoString)
  if (Number.isNaN(data.getTime())) {
    return 0
  }
  const diffMs = Date.now() - data.getTime()
  return diffMs <= 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

const formatarDataCurta = (isoString: string) => {
  const data = new Date(isoString)
  if (Number.isNaN(data.getTime())) {
    return '—'
  }
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const sanitizarLeadCrm = (valor: Partial<CrmLeadRecord>): CrmLeadRecord => {
  const agoraIso = new Date().toISOString()
  const etapaValida = CRM_PIPELINE_STAGES.some((stage) => stage.id === valor.etapa)
    ? (valor.etapa as CrmStageId)
    : 'novo-lead'

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('lead'),
    nome: typeof valor.nome === 'string' ? valor.nome : '',
    telefone: typeof valor.telefone === 'string' ? valor.telefone : '',
    email: typeof valor.email === 'string' && valor.email ? valor.email : undefined,
    cidade: typeof valor.cidade === 'string' ? valor.cidade : '',
    tipoImovel: typeof valor.tipoImovel === 'string' ? valor.tipoImovel : 'Não informado',
    consumoKwhMes: Number.isFinite(valor.consumoKwhMes)
      ? Math.max(0, Math.round(valor.consumoKwhMes as number))
      : 0,
    origemLead: typeof valor.origemLead === 'string' && valor.origemLead
      ? valor.origemLead
      : 'Cadastro manual',
    interesse: typeof valor.interesse === 'string' && valor.interesse ? valor.interesse : 'Leasing',
    tipoOperacao: valor.tipoOperacao === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
    valorEstimado: Number.isFinite(valor.valorEstimado)
      ? Math.max(0, Math.round(valor.valorEstimado as number))
      : 0,
    etapa: etapaValida,
    ultimoContatoIso:
      typeof valor.ultimoContatoIso === 'string' && valor.ultimoContatoIso
        ? valor.ultimoContatoIso
        : agoraIso,
    criadoEmIso:
      typeof valor.criadoEmIso === 'string' && valor.criadoEmIso ? valor.criadoEmIso : agoraIso,
    notas: typeof valor.notas === 'string' && valor.notas ? valor.notas : undefined,
    instalacaoStatus:
      valor.instalacaoStatus && CRM_INSTALACAO_STATUS.some((item) => item.id === valor.instalacaoStatus)
        ? valor.instalacaoStatus
        : 'planejamento',
  }
}

const sanitizarContratoCrm = (
  valor: Partial<CrmContratoFinanceiro>,
  leadIds: Set<string>,
): CrmContratoFinanceiro | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const parcelas = Number.isFinite(valor.parcelas) ? Math.max(0, Math.round(valor.parcelas as number)) : 0
  const valorParcela = Number.isFinite(valor.valorParcela)
    ? Math.max(0, Number(valor.valorParcela))
    : 0
  const valorTotal = Number.isFinite(valor.valorTotal) ? Math.max(0, Number(valor.valorTotal)) : 0
  const entrada = Number.isFinite(valor.entrada) ? Math.max(0, Number(valor.entrada)) : 0
  const reajuste = Number.isFinite(valor.reajusteAnualPct)
    ? Math.max(0, Number(valor.reajusteAnualPct))
    : 0

  const modelo = valor.modelo === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING'
  const status: CrmFinanceiroStatus =
    valor.status === 'ativo' || valor.status === 'inadimplente' || valor.status === 'quitado'
      ? valor.status
      : 'em-aberto'

  const vencimentoIso =
    typeof valor.vencimentoInicialIso === 'string' && valor.vencimentoInicialIso
      ? valor.vencimentoInicialIso
      : new Date().toISOString()

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('contrato'),
    leadId: valor.leadId,
    modelo,
    valorTotal,
    entrada,
    parcelas,
    valorParcela,
    reajusteAnualPct: reajuste,
    vencimentoInicialIso: vencimentoIso,
    status,
  }
}

const sanitizarLancamentoCrm = (
  valor: Partial<CrmLancamentoCaixa>,
  leadIds: Set<string>,
): CrmLancamentoCaixa | null => {
  const dataIso = typeof valor.dataIso === 'string' && valor.dataIso ? valor.dataIso : new Date().toISOString()
  const categoria = CRM_FINANCEIRO_CATEGORIAS.includes((valor.categoria as CrmLancamentoCaixa['categoria']) ?? 'Receita')
    ? (valor.categoria as CrmLancamentoCaixa['categoria'])
    : 'Receita'
  const forma = CRM_FORMAS_PAGAMENTO.includes(
    (valor.formaPagamento as CrmLancamentoCaixa['formaPagamento']) ?? 'Pix',
  )
    ? (valor.formaPagamento as CrmLancamentoCaixa['formaPagamento'])
    : 'Pix'
  const tipo = valor.tipo === 'saida' ? 'saida' : 'entrada'
  const valorNumerico = Number.isFinite(valor.valor) ? Number(valor.valor) : 0

  if (valor.leadId && !leadIds.has(valor.leadId)) {
    return null
  }

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('lancamento'),
    leadId: valor.leadId && leadIds.has(valor.leadId) ? valor.leadId : undefined,
    dataIso,
    categoria,
    origem: typeof valor.origem === 'string' && valor.origem ? valor.origem : 'Operação',
    formaPagamento: forma,
    tipo,
    valor: valorNumerico,
    observacao:
      typeof valor.observacao === 'string' && valor.observacao ? valor.observacao.slice(0, 280) : undefined,
  }
}

const sanitizarCustoCrm = (
  valor: Partial<CrmCustoProjeto>,
  leadIds: Set<string>,
): CrmCustoProjeto | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const normalizar = (numero?: number) => (Number.isFinite(numero) ? Math.max(0, Number(numero)) : 0)

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('custo'),
    leadId: valor.leadId,
    equipamentos: normalizar(valor.equipamentos),
    maoDeObra: normalizar(valor.maoDeObra),
    deslocamento: normalizar(valor.deslocamento),
    taxasSeguros: normalizar(valor.taxasSeguros),
  }
}

const sanitizarManutencaoCrm = (
  valor: Partial<CrmManutencaoRegistro>,
  leadIds: Set<string>,
): CrmManutencaoRegistro | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const status = valor.status === 'concluida' ? 'concluida' : 'pendente'
  const dataIso = typeof valor.dataIso === 'string' && valor.dataIso ? valor.dataIso : new Date().toISOString()

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('manutencao'),
    leadId: valor.leadId,
    dataIso,
    tipo: typeof valor.tipo === 'string' && valor.tipo ? valor.tipo : 'Revisão preventiva',
    status,
    observacao:
      typeof valor.observacao === 'string' && valor.observacao ? valor.observacao.slice(0, 280) : undefined,
  }
}

const sanitizarEventoCrm = (
  valor: Partial<CrmTimelineEntry>,
  leadIds: Set<string>,
): CrmTimelineEntry | null => {
  const leadId = typeof valor.leadId === 'string' ? valor.leadId : ''
  const mensagem = typeof valor.mensagem === 'string' ? valor.mensagem : ''
  if (!leadId || !mensagem || !leadIds.has(leadId)) {
    return null
  }

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('evento'),
    leadId,
    mensagem,
    tipo: valor.tipo === 'anotacao' ? 'anotacao' : 'status',
    criadoEmIso:
      typeof valor.criadoEmIso === 'string' && valor.criadoEmIso
        ? valor.criadoEmIso
        : new Date().toISOString(),
  }
}

const sanitizarDatasetCrm = (valor: unknown): CrmDataset => {
  if (!valor || typeof valor !== 'object') {
    return { ...CRM_DATASET_VAZIO }
  }

  const bruto = valor as Partial<CrmDataset>
  const leads = Array.isArray(bruto.leads)
    ? bruto.leads.map((item) => sanitizarLeadCrm(item as Partial<CrmLeadRecord>))
    : []
  const leadIds = new Set(leads.map((lead) => lead.id))
  const timeline = Array.isArray(bruto.timeline)
    ? bruto.timeline
        .map((item) => sanitizarEventoCrm(item as Partial<CrmTimelineEntry>, leadIds))
        .filter((item): item is CrmTimelineEntry => Boolean(item))
    : []

  const contratos = Array.isArray(bruto.contratos)
    ? bruto.contratos
        .map((item) => sanitizarContratoCrm(item as Partial<CrmContratoFinanceiro>, leadIds))
        .filter((item): item is CrmContratoFinanceiro => Boolean(item))
    : []

  const lancamentos = Array.isArray(bruto.lancamentos)
    ? bruto.lancamentos
        .map((item) => sanitizarLancamentoCrm(item as Partial<CrmLancamentoCaixa>, leadIds))
        .filter((item): item is CrmLancamentoCaixa => Boolean(item))
    : []

  const custos = Array.isArray(bruto.custos)
    ? bruto.custos
        .map((item) => sanitizarCustoCrm(item as Partial<CrmCustoProjeto>, leadIds))
        .filter((item): item is CrmCustoProjeto => Boolean(item))
    : []

  const manutencoes = Array.isArray(bruto.manutencoes)
    ? bruto.manutencoes
        .map((item) => sanitizarManutencaoCrm(item as Partial<CrmManutencaoRegistro>, leadIds))
        .filter((item): item is CrmManutencaoRegistro => Boolean(item))
    : []

  leads.sort((a, b) => (a.ultimoContatoIso < b.ultimoContatoIso ? 1 : -1))
  timeline.sort((a, b) => (a.criadoEmIso < b.criadoEmIso ? 1 : -1))

  contratos.sort((a, b) => (a.vencimentoInicialIso < b.vencimentoInicialIso ? -1 : 1))
  lancamentos.sort((a, b) => (a.dataIso < b.dataIso ? 1 : -1))
  manutencoes.sort((a, b) => (a.dataIso > b.dataIso ? 1 : -1))

  return { leads, timeline, contratos, lancamentos, custos, manutencoes }
}

const carregarDatasetCrm = (): CrmDataset => {
  if (typeof window === 'undefined') {
    return { ...CRM_DATASET_VAZIO }
  }

  const existente = window.localStorage.getItem(CRM_LOCAL_STORAGE_KEY)
  if (!existente) {
    return { ...CRM_DATASET_VAZIO }
  }

  try {
    const parsed = JSON.parse(existente)
    return sanitizarDatasetCrm(parsed)
  } catch (error) {
    console.warn('Não foi possível interpretar o dataset do CRM salvo localmente.', error)
    return { ...CRM_DATASET_VAZIO }
  }
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
                        <th>ID</th>
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
                            <td className="clients-table-id">
                              <code>{registro.id}</code>
                            </td>
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

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <span className="field-error">{message}</span> : null

const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProps>(function PrintableProposal(
  {
    cliente,
    budgetId,
    anos,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
    tabelaBuyout,
    buyoutResumo,
    capex,
    tipoProposta,
    geracaoMensalKwh,
    potenciaPlaca,
    numeroPlacas,
    potenciaInstaladaKwp,
    tipoInstalacao,
    areaInstalacao,
    descontoContratualPct,
    parcelasLeasing,
    distribuidoraTarifa,
    energiaContratadaKwh,
    tarifaCheia,
    vendaResumo: vendaResumoProp,
  },
  ref,
) {
  const isVendaDireta = tipoProposta === 'VENDA_DIRETA'
  const vendaResumo = isVendaDireta && vendaResumoProp ? vendaResumoProp : null
  const vendaFormResumo = vendaResumo?.form
  const retornoVenda = vendaResumo?.retorno ?? null
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    Number.isFinite(value) ? value.toLocaleString('pt-BR', options) : '—'
  const formatPercentFromFraction = (value?: number, fractionDigits = 2) => {
    if (!Number.isFinite(value)) {
      return '—'
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value ?? 0)
  }
  const formatPercentFromPct = (value?: number, fractionDigits = 2) => {
    if (!Number.isFinite(value)) {
      return '—'
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format((value ?? 0) / 100)
  }
  const formatKwhMes = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumber(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh/mês`
  }
  const formatMeses = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    const inteiro = Math.round(value ?? 0)
    return `${inteiro} meses`
  }
  const formatParcelas = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    const inteiro = Math.round(value ?? 0)
    return `${inteiro} parcelas`
  }
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const tipoInstalacaoDescricao =
    tipoInstalacao === 'SOLO' ? 'Solo' : tipoInstalacao === 'TELHADO' ? 'Telhado' : '—'
  const areaInstalacaoValida = Number.isFinite(areaInstalacao) && areaInstalacao > 0
  const areaInstalacaoTexto = areaInstalacaoValida
    ? areaInstalacao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '—'
  const distribuidoraTarifaLabel = distribuidoraTarifa?.trim() || ''
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : ''
  const codigoOrcamento =
    vendaFormResumo?.numero_orcamento_vendor?.trim() || budgetId?.trim() || ''
  const emailCliente = cliente.email?.trim() || ''
  const telefoneCliente = cliente.telefone?.trim() || ''
  const ucCliente = cliente.uc?.trim() || ''
  const cidadeCliente = cliente.cidade?.trim() || ''
  const ufCliente = cliente.uf?.trim() || ''
  const enderecoCliente = cliente.endereco?.trim() || ''
  const quantidadeModulosResumo = (() => {
    const quantidade =
      vendaFormResumo && Number.isFinite(vendaFormResumo.quantidade_modulos)
        ? Number(vendaFormResumo.quantidade_modulos)
        : Number.isFinite(numeroPlacas)
        ? Number(numeroPlacas)
        : null
    if (!Number.isFinite(quantidade) || (quantidade ?? 0) <= 0) {
      return '—'
    }
    return `${Math.round(quantidade ?? 0)} un.`
  })()
  const modeloModuloResumo = vendaFormResumo?.modelo_modulo?.trim() || '—'
  const modeloInversorResumo = vendaFormResumo?.modelo_inversor?.trim() || '—'
  const estruturaResumo = vendaFormResumo?.estrutura_suporte?.trim() || '—'
  const prazoContratualResumo = isVendaDireta
    ? 'Venda'
    : duracaoContratualValida
    ? `${buyoutResumo.duracao} meses`
    : '60 meses'
  const formatEnergiaContratada = (valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return '—'
    }
    const possuiDecimais = Math.abs(valor - Math.round(valor)) > 1e-6
    return `${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: possuiDecimais ? 2 : 0,
      maximumFractionDigits: possuiDecimais ? 2 : 0,
    })} kWh/mês`
  }
  const energiaContratadaResumo = formatEnergiaContratada(energiaContratadaKwh)
  const tarifaCheiaResumo = tarifaCheia > 0 ? tarifaCurrency(tarifaCheia) : '—'
  const descontoResumo =
    !isVendaDireta && Number.isFinite(descontoContratualPct)
      ? `${formatNumber(descontoContratualPct, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
      : '—'
  const responsabilidadesResumo = isVendaDireta
    ? 'Projeto, instalação, homologação e suporte pós-venda'
    : 'Instalação, homologação, manutenção, seguro, suporte técnico, monitoramento'
  const valorInstalacaoTexto = isVendaDireta ? currency(capex) : currency(0)
  const geracaoMensalResumo = formatKwhMes(geracaoMensalKwh)
  const potenciaInstaladaTexto =
    Number.isFinite(potenciaInstaladaKwp) && potenciaInstaladaKwp > 0
      ? `${formatNumber(potenciaInstaladaKwp, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} kWp`
      : '—'
  const investimentoLabel = isVendaDireta ? 'Investimento total (CAPEX)' : 'Investimento da SolarInvest'
  const condicaoLabel = (() => {
    if (!vendaFormResumo) {
      return '—'
    }
    switch (vendaFormResumo.condicao) {
      case 'AVISTA':
        return 'À vista'
      case 'PARCELADO':
        return 'Parcelado'
      case 'FINANCIAMENTO':
        return 'Financiamento'
      default:
        return '—'
    }
  })()
  const isCondicaoAvista = vendaFormResumo?.condicao === 'AVISTA'
  const isCondicaoParcelado = vendaFormResumo?.condicao === 'PARCELADO'
  const isCondicaoFinanciamento = vendaFormResumo?.condicao === 'FINANCIAMENTO'
  const modoPagamentoTipo = vendaFormResumo?.modo_pagamento ?? 'PIX'
  const modoPagamentoLabel =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? 'Pix'
        : modoPagamentoTipo === 'DEBITO'
        ? 'Cartão de débito'
        : 'Cartão de crédito'
      : null
  const mdrSelecionadoValor =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? vendaFormResumo.taxa_mdr_pix_pct
        : modoPagamentoTipo === 'DEBITO'
        ? vendaFormResumo.taxa_mdr_debito_pct
        : vendaFormResumo.taxa_mdr_credito_vista_pct
      : undefined
  const consumoResumo = formatKwhMes(vendaFormResumo?.consumo_kwh_mes)
  const tarifaInicialResumo = Number.isFinite(vendaFormResumo?.tarifa_cheia_r_kwh)
    ? tarifaCurrency(vendaFormResumo?.tarifa_cheia_r_kwh ?? 0)
    : tarifaCheiaResumo
  const inflacaoResumo = formatPercentFromPct(vendaFormResumo?.inflacao_energia_aa_pct)
  const taxaMinimaResumo = Number.isFinite(vendaFormResumo?.taxa_minima_mensal)
    ? currency(vendaFormResumo?.taxa_minima_mensal ?? 0)
    : '—'
  const horizonteAnaliseResumo = formatMeses(vendaFormResumo?.horizonte_meses)
  const taxaDescontoResumo = Number.isFinite(vendaFormResumo?.taxa_desconto_aa_pct)
    ? formatPercentFromPct(vendaFormResumo?.taxa_desconto_aa_pct)
    : null
  const parcelasResumo = formatParcelas(vendaFormResumo?.n_parcelas)
  const jurosCartaoAmResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_am_pct)
  const jurosCartaoAaResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_aa_pct)
  const mdrPixResumo = formatPercentFromFraction(vendaFormResumo?.taxa_mdr_pix_pct)
  const mdrDebitoResumo = formatPercentFromFraction(vendaFormResumo?.taxa_mdr_debito_pct)
  const mdrCreditoVistaResumo = formatPercentFromFraction(vendaFormResumo?.taxa_mdr_credito_vista_pct)
  const mdrCreditoParceladoResumo = formatPercentFromFraction(
    vendaFormResumo?.taxa_mdr_credito_parcelado_pct,
  )
  const entradaResumo = Number.isFinite(vendaFormResumo?.entrada_financiamento)
    ? currency(vendaFormResumo?.entrada_financiamento ?? 0)
    : '—'
  const parcelasFinResumo = formatParcelas(vendaFormResumo?.n_parcelas_fin)
  const jurosFinAmResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_am_pct)
  const jurosFinAaResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_aa_pct)
  const mesesRetorno = retornoVenda ? retornoVenda.economia.map((_, index) => index) : []
  const paybackLabelResumo = retornoVenda?.payback
    ? `${retornoVenda.payback} meses`
    : 'Não atingido no horizonte analisado'
  const roiLabelResumo = retornoVenda
    ? new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(retornoVenda.roi)
    : '—'
  const vplResumo = typeof retornoVenda?.vpl === 'number' ? currency(retornoVenda.vpl) : '—'
  const roiHorizonteResumo =
    Number.isFinite(vendaFormResumo?.horizonte_meses) && (vendaFormResumo?.horizonte_meses ?? 0) > 0
      ? `${Math.round(vendaFormResumo?.horizonte_meses ?? 0)} meses`
      : 'horizonte analisado'
  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const inicioOperacaoData = new Date(emissaoData.getTime())
  inicioOperacaoData.setDate(inicioOperacaoData.getDate() + 60)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const inicioOperacaoTexto = formatDate(inicioOperacaoData)
  const heroTitle = isVendaDireta ? 'Proposta de Venda Solar' : 'Proposta de Leasing Solar'
  const heroTagline = isVendaDireta
    ? 'Energia inteligente, patrimônio garantido'
    : 'Energia inteligente, sem desembolso'
  const heroSummaryDescription = isVendaDireta
    ? 'Apresentamos sua proposta personalizada de aquisição da usina fotovoltaica SolarInvest. Nesta modalidade de venda, você investe no sistema, torna-se proprietário desde o primeiro dia e captura 100% da economia gerada, aumentando a previsibilidade de custos e o valor do seu imóvel.'
    : 'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const chartEconomiaIntro = isVendaDireta
    ? 'Retorno que cresce ano após ano.'
    : 'Economia que cresce ano após ano.'
  const chartExplainerContext = isVendaDireta
    ? 'O investimento considera os reajustes anuais de energia, a vida útil projetada dos equipamentos e a propriedade integral do ativo desde o primeiro dia.'
    : 'Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.'
  const chartFootnoteText = isVendaDireta
    ? 'Como proprietário do sistema, toda a economia permanece com o cliente ao longo da vida útil do projeto.'
    : 'Após o final do contrato a usina passa a render 100% de economia frente à concessionária para o cliente.'
  const chartPrimaryLabel = isVendaDireta ? 'Venda' : 'Leasing SolarInvest'

  const chartDataPrintable = useMemo(() => {
    const anosDisponiveis = new Set(anos)

    return BENEFICIO_CHART_ANOS.filter((ano) => anosDisponiveis.has(ano)).map((ano) => ({
      ano,
      Leasing: leasingROI[ano - 1] ?? 0,
      Financiamento: financiamentoROI[ano - 1] ?? 0,
    }))
  }, [anos, financiamentoROI, leasingROI])
  const beneficioMarcos = useMemo(
    () =>
      BENEFICIO_CHART_ANOS.map((ano) => {
        const dadosAno = chartDataPrintable.find((row) => row.ano === ano)
        if (!dadosAno) {
          return null
        }
        return {
          ano,
          Leasing: dadosAno.Leasing,
          Financiamento: dadosAno.Financiamento,
        }
      }).filter((row): row is { ano: number; Leasing: number; Financiamento: number } => row !== null),
    [chartDataPrintable],
  )
  const chartPrintableDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    chartDataPrintable.forEach((row) => {
      const valores = [row.Leasing]
      if (mostrarFinanciamento) {
        valores.push(row.Financiamento)
      }

      valores.forEach((valor) => {
        if (Number.isFinite(valor)) {
          min = Math.min(min, valor)
          max = Math.max(max, valor)
        }
      })
    })

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: -1, max: 1 }
    }

    min = Math.min(min, 0)
    max = Math.max(max, 0)

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.25, 1)
      return { min: min - padding, max: max + padding }
    }

    const range = max - min
    const padding = range * 0.12

    return {
      min: min - padding,
      max: max + padding,
    }
  }, [chartDataPrintable, mostrarFinanciamento])

  const parcelasLeasingAnuais = useMemo<MensalidadeAnualRow[]>(() => {
    if (!parcelasLeasing.length) {
      return []
    }

    const mesesPorAno = 12
    const totalAnos = Math.min(5, Math.ceil(parcelasLeasing.length / mesesPorAno))

    return Array.from({ length: totalAnos }, (_, index) => {
      const inicio = index * mesesPorAno
      const fim = inicio + mesesPorAno
      const mesesAno = parcelasLeasing.slice(inicio, fim)
      const divisor = mesesAno.length || 1

      const somaTarifaCheia = mesesAno.reduce((acc, row) => acc + row.tarifaCheia, 0)
      const somaTarifaDescontada = mesesAno.reduce((acc, row) => acc + row.tarifaDescontada, 0)
      const somaMensalidadeCheia = mesesAno.reduce((acc, row) => acc + row.mensalidadeCheia, 0)
      const somaMensalidade = mesesAno.reduce((acc, row) => acc + row.mensalidade, 0)

      return {
        ano: index + 1,
        tarifaCheiaMedia: somaTarifaCheia / divisor,
        tarifaDescontadaMedia: somaTarifaDescontada / divisor,
        mensalidadeCheiaMedia: somaMensalidadeCheia / divisor,
        mensalidadeMedia: somaMensalidade / divisor,
      }
    })
  }, [parcelasLeasing])
  const beneficioAno30Printable = useMemo(
    () => chartDataPrintable.find((row) => row.ano === 30) ?? null,
    [chartDataPrintable],
  )
  return (
    <div ref={ref} className="print-layout">
      <header className="print-hero">
        <div className="print-hero__header">
          <div className="print-hero__identity">
            <div className="print-logo">
              <img src="/logo.svg" alt="SolarInvest" />
            </div>
            <div className="print-hero__title">
              <span className="print-hero__eyebrow">SolarInvest</span>
              <h1>{heroTitle}</h1>
              <p className="print-hero__tagline">{heroTagline}</p>
            </div>
          </div>
        </div>
        <div className="print-hero__summary">
          <h2>Sumário executivo</h2>
          <p>{heroSummaryDescription}</p>
        </div>
      </header>

      <section className="print-section">
        <h2>Identificação do cliente</h2>
        <dl className="print-client-grid">
          <div className="print-client-field">
            <dt>Código do orçamento</dt>
            <dd>{codigoOrcamento || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Cliente</dt>
            <dd>{cliente.nome || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Documento</dt>
            <dd>{documentoCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>UC</dt>
            <dd>{ucCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Distribuidora</dt>
            <dd>{distribuidoraTarifaLabel || cliente.distribuidora || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>E-mail</dt>
            <dd>{emailCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Telefone</dt>
            <dd>{telefoneCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Cidade / UF</dt>
            <dd>{cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—'}</dd>
          </div>
          <div className="print-client-field print-client-field--wide">
            <dt>Endereço</dt>
            <dd>
              {enderecoCliente
                ? enderecoCliente
                : cidadeCliente || ufCliente
                ? `${cidadeCliente || '—'} / ${ufCliente || '—'}`
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="print-section">
        <h2>Quadro comercial resumido</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Condição Comercial</th>
              <th>Valor/Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{isVendaDireta ? 'Modelo comercial' : 'Prazo contratual'}</td>
              <td>{prazoContratualResumo}</td>
            </tr>
            <tr>
              <td>Energia contratada (kWh/mês)</td>
              <td>{energiaContratadaResumo}</td>
            </tr>
            <tr>
              <td>Tarifa cheia da distribuidora</td>
              <td>{tarifaCheiaResumo}</td>
            </tr>
            {!isVendaDireta ? (
              <tr>
                <td>Desconto aplicado</td>
                <td>{descontoResumo}</td>
              </tr>
            ) : null}
            <tr>
              <td>{isVendaDireta ? 'Investimento total (CAPEX)' : 'Valor da instalação para o cliente'}</td>
              <td>{valorInstalacaoTexto}</td>
            </tr>
            <tr>
              <td>Início estimado da operação</td>
              <td>{inicioOperacaoTexto}</td>
            </tr>
            <tr>
              <td>Responsabilidades da SolarInvest</td>
              <td>{responsabilidadesResumo}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="print-section">
        <h2>Resumo técnico e financeiro</h2>
        <div className="print-key-values">
          <p>
            <strong>{investimentoLabel}</strong>
            {currency(capex)}
          </p>
          <p>
            <strong>Potência instalada (kWp)</strong>
            {potenciaInstaladaTexto}
          </p>
          <p>
            <strong>Geração estimada (kWh/mês)</strong>
            {geracaoMensalResumo}
          </p>
          <p>
            <strong>Energia contratada</strong>
            {energiaContratadaResumo}
          </p>
          <p>
            <strong>Quantidade de módulos</strong>
            {quantidadeModulosResumo}
          </p>
          <p>
            <strong>Modelo dos módulos</strong>
            {modeloModuloResumo}
          </p>
          <p>
            <strong>Modelo dos inversores</strong>
            {modeloInversorResumo}
          </p>
          <p>
            <strong>Estrutura de fixação</strong>
            {estruturaResumo}
          </p>
          <p>
            <strong>Tipo de instalação</strong>
            {tipoInstalacaoDescricao}
          </p>
          <p>
            <strong>Área utilizada (m²)</strong>
            {areaInstalacaoTexto}
          </p>
        </div>
        <div className="print-summary-grid">
          {isVendaDireta ? (
            <div className="print-card">
              <h3>Resumo da venda</h3>
              <div className="print-metric-list">
                <p>
                  <strong>Modelo comercial</strong>
                  Venda
                </p>
                <p>
                  <strong>Condição selecionada</strong>
                  {condicaoLabel}
                </p>
                <p>
                  <strong>Investimento total</strong>
                  {currency(capex)}
                </p>
                {modoPagamentoLabel ? (
                  <p>
                    <strong>Modo de pagamento</strong>
                    {modoPagamentoLabel}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="print-card">
              <h3>Mensalidades por ano</h3>
              {parcelasLeasingAnuais.length > 0 ? (
                <div className="print-yearly-payments">
                  {parcelasLeasingAnuais.map((row) => (
                    <article className="print-yearly-payments__item" key={`leasing-${row.ano}`}>
                      <div className="print-yearly-payments__header">
                        <span className="print-yearly-payments__year-label">Período</span>
                        <span className="print-yearly-payments__year">{`${row.ano}º ano`}</span>
                      </div>
                      <dl className="print-yearly-payments__metrics">
                        <div>
                          <dt>Tarifa cheia média</dt>
                          <dd>{tarifaCurrency(row.tarifaCheiaMedia)}</dd>
                        </div>
                        <div>
                          <dt>Tarifa c/ desconto média</dt>
                          <dd>{tarifaCurrency(row.tarifaDescontadaMedia)}</dd>
                        </div>
                        <div>
                          <dt>
                            Conta {distribuidoraTarifaLabel ? distribuidoraTarifaLabel : 'distribuidora'}
                          </dt>
                          <dd>{currency(row.mensalidadeCheiaMedia)}</dd>
                        </div>
                        <div>
                          <dt>Mensalidade SolarInvest</dt>
                          <dd>{currency(row.mensalidadeMedia)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="print-yearly-payments__empty muted">
                  Defina um prazo contratual para gerar a projeção das médias anuais das parcelas.
                </p>
              )}
            </div>
          )}
          {mostrarFinanciamento ? (
            <div className="print-card">
              <h3>Financiamento</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Fluxo anual</th>
                    <th>Benefício acumulado</th>
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

      {isVendaDireta ? (
        <section className="print-section">
          <h2>Condições de pagamento</h2>
          {vendaFormResumo ? (
            <>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Condição</td>
                    <td>{condicaoLabel}</td>
                  </tr>
                  <tr>
                    <td>Investimento (CAPEX)</td>
                    <td>{currency(capex)}</td>
                  </tr>
                  {modoPagamentoLabel ? (
                    <tr>
                      <td>Modo de pagamento</td>
                      <td>{modoPagamentoLabel}</td>
                    </tr>
                  ) : null}
                  {isCondicaoAvista && mdrSelecionadoValor !== undefined ? (
                    <tr>
                      <td>MDR aplicado ({modoPagamentoLabel ?? 'selecionado'})</td>
                      <td>{formatPercentFromFraction(mdrSelecionadoValor)}</td>
                    </tr>
                  ) : null}
                  {isCondicaoAvista ? (
                    <>
                      <tr>
                        <td>MDR Pix</td>
                        <td>{mdrPixResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR débito</td>
                        <td>{mdrDebitoResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR crédito à vista</td>
                        <td>{mdrCreditoVistaResumo}</td>
                      </tr>
                    </>
                  ) : null}
                  {isCondicaoParcelado ? (
                    <>
                      <tr>
                        <td>Número de parcelas</td>
                        <td>{parcelasResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do cartão (% a.m.)</td>
                        <td>{jurosCartaoAmResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do cartão (% a.a.)</td>
                        <td>{jurosCartaoAaResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR crédito parcelado</td>
                        <td>{mdrCreditoParceladoResumo}</td>
                      </tr>
                    </>
                  ) : null}
                  {isCondicaoFinanciamento ? (
                    <>
                      <tr>
                        <td>Entrada</td>
                        <td>{entradaResumo}</td>
                      </tr>
                      <tr>
                        <td>Número de parcelas</td>
                        <td>{parcelasFinResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do financiamento (% a.m.)</td>
                        <td>{jurosFinAmResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do financiamento (% a.a.)</td>
                        <td>{jurosFinAaResumo}</td>
                      </tr>
                    </>
                  ) : null}
                </tbody>
              </table>
              <h3 className="print-subheading">Parâmetros de economia</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Consumo considerado</td>
                    <td>{consumoResumo}</td>
                  </tr>
                  <tr>
                    <td>Tarifa inicial</td>
                    <td>{tarifaInicialResumo}</td>
                  </tr>
                  <tr>
                    <td>Inflação de energia (a.a.)</td>
                    <td>{inflacaoResumo}</td>
                  </tr>
                  <tr>
                    <td>Taxa mínima mensal</td>
                    <td>{taxaMinimaResumo}</td>
                  </tr>
                  <tr>
                    <td>Horizonte de análise</td>
                    <td>{horizonteAnaliseResumo}</td>
                  </tr>
                  {taxaDescontoResumo ? (
                    <tr>
                      <td>Taxa de desconto (a.a.)</td>
                      <td>{taxaDescontoResumo}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">
              Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
            </p>
          )}
        </section>
      ) : null}

      {isVendaDireta ? (
        <section className="print-section">
          <h2>Retorno projetado</h2>
          {retornoVenda ? (
            <>
              <div className="print-kpi-grid">
                <div className="print-kpi">
                  <span>Payback estimado</span>
                  <strong>{paybackLabelResumo}</strong>
                </div>
                <div className="print-kpi">
                  <span>ROI acumulado ({roiHorizonteResumo})</span>
                  <strong>{roiLabelResumo}</strong>
                </div>
                <div className="print-kpi">
                  <span>VPL</span>
                  <strong>{vplResumo}</strong>
                </div>
              </div>
              <h3 className="print-subheading">Fluxo mensal</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Economia</th>
                    <th>Pagamento</th>
                    <th>Fluxo líquido</th>
                    <th>Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesRetorno.map((mes) => (
                    <tr key={`retorno-print-${mes}`}>
                      <td>{mes}</td>
                      <td>{currency(retornoVenda.economia[mes] ?? 0)}</td>
                      <td>{currency(retornoVenda.pagamentoMensal[mes] ?? 0)}</td>
                      <td>{currency(retornoVenda.fluxo[mes] ?? 0)}</td>
                      <td>{currency(retornoVenda.saldo[mes] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">
              Informe os parâmetros financeiros na aba Vendas para calcular o retorno projetado.
            </p>
          )}
        </section>
      ) : null}

      <section className="print-section print-chart-section">
        <h2>{isVendaDireta ? 'Retorno projetado (30 anos)' : 'Economia projetada (30 anos)'}</h2>
        <div className="print-chart">
          <ResponsiveContainer width="50%" height={240}>
            <BarChart
              layout="vertical"
              data={chartDataPrintable}
              margin={{ top: 5, right: 6, bottom: 7, left: 6 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="#0f172a"
                tickFormatter={formatAxis}
                tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                tickLine={false}
                domain={[chartPrintableDomain.min, chartPrintableDomain.max]}
              >
                <Label
                  value="Benefício acumulado (R$)"
                  position="insideBottom"
                  offset={-32}
                  style={{ fill: '#0f172a', fontSize: 13, fontWeight: 700 }}
                />
              </XAxis>
              <YAxis
                type="category"
                dataKey="ano"
                stroke="#0f172a"
                tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                tickLine={false}
                width={120}
                tickFormatter={(valor) => `${valor}º ano`}
              />
              <Tooltip
                formatter={(value: number) => currency(Number(value))}
                labelFormatter={(value) => `${value}º ano`}
                contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', padding: 12 }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              {mostrarFinanciamento ? (
                <Legend
                  verticalAlign="top"
                  align="left"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 16 }}
                  payload={[
                    {
                      id: 'Financiamento',
                      value: 'Financiamento SolarInvest',
                      type: 'circle',
                      color: chartColors.Financiamento,
                    },
                  ]}
                />
              ) : null}
              <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" strokeWidth={1} />
              <Bar
                dataKey="Leasing"
                fill={chartColors.Leasing}
                barSize={14}
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                name={chartPrimaryLabel}
              >
                <LabelList
                  dataKey="Leasing"
                  position="right"
                  formatter={(value: number) => currency(Number(value))}
                  fill={chartColors.Leasing}
                  style={{ fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
              {mostrarFinanciamento ? (
                <Bar
                  dataKey="Financiamento"
                  fill={chartColors.Financiamento}
                  barSize={14}
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="Financiamento"
                    position="right"
                    formatter={(value: number) => currency(Number(value))}
                    fill={chartColors.Financiamento}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {beneficioMarcos.length ? (
          <ul className="print-chart-highlights">
            {beneficioMarcos.map((marco) => (
              <li key={`beneficio-marco-resumo-${marco.ano}`}>
                <span className="print-chart-highlights__year">{marco.ano}º ano</span>
                <div className="print-chart-highlights__values">
                  <span className="print-chart-highlights__value" style={{ color: chartColors.Leasing }}>
                    {chartPrimaryLabel}: {currency(marco.Leasing)}
                  </span>
                  {mostrarFinanciamento ? (
                    <span className="print-chart-highlights__value" style={{ color: chartColors.Financiamento }}>
                      Financiamento: {currency(marco.Financiamento)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {beneficioAno30Printable ? (
          <p className="chart-explainer">
            <strong>{chartEconomiaIntro}</strong>{' '}
            Em <strong>30 anos</strong>, a SolarInvest projeta um benefício acumulado de
            <strong style={{ color: chartColors.Leasing }}> {currency(beneficioAno30Printable.Leasing)}</strong>
            {mostrarFinanciamento ? (
              <>
                {' '}
                {isVendaDireta ? 'na venda direta e de' : 'no leasing e de'}
                <strong style={{ color: chartColors.Financiamento }}>
                  {' '}
                  {currency(beneficioAno30Printable.Financiamento)}
                </strong>{' '}
                {isVendaDireta
                  ? 'com financiamento como alternativa de pagamento.'
                  : 'com financiamento.'}
              </>
            ) : (
              <> comparado à concessionária.</>
            )}{' '}
            {chartExplainerContext}
          </p>
        ) : null}
        <p className="print-chart-footnote">{chartFootnoteText}</p>
      </section>

      <section className="print-section print-important">
        <h2>Informações importantes</h2>
        <ul>
          {isVendaDireta ? (
            <>
              <li>Esta proposta refere-se à venda do sistema fotovoltaico (não inclui serviços de leasing).</li>
              <li>Todos os equipamentos utilizados possuem certificação INMETRO (ou equivalente) e seguem as normas técnicas aplicáveis.</li>
              <li>Os valores, condições de pagamento e prazos apresentados são estimativas preliminares e podem ser ajustados na contratação definitiva.</li>
              <li>A projeção de economia considera: produção estimada, tarifa de energia inicial e inflação de energia informadas, e a taxa mínima aplicável em sistemas on-grid.</li>
              <li>As parcelas/encargos de cartão e/ou financiamento impactam o fluxo de caixa e o ROI projetado.</li>
              <li>A geração real pode variar conforme radiação solar, sombreamento, temperatura e condições de instalação/operação.</li>
              <li>O cronograma de entrega e instalação está sujeito a vistoria técnica e disponibilidade de estoque.</li>
              <li>Garantias dos fabricantes seguem seus termos. Manutenção preventiva/corretiva e seguros podem ser contratados à parte (se aplicável).</li>
            </>
          ) : (
            <>
              <li>Desconto contratual aplicado: {descontoResumo} sobre a tarifa da distribuidora.</li>
              <li>Prazo de vigência: conforme especificado na proposta (ex.: 60 meses).</li>
              <li>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</li>
              <li>
                Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e seguro sinistro da usina.
              </li>
              <li>
                Transferência da usina ao cliente ao final do contrato sem custo adicional, desde que obrigações contratuais estejam
                cumpridas.
              </li>
              <li>Tabela de compra antecipada disponível mediante solicitação.</li>
              <li>Equipamentos utilizados possuem certificação INMETRO.</li>
              <li>
                Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer ajustes no contrato definitivo.
              </li>
            </>
          )}
        </ul>
      </section>

      <section className="print-section print-cta">
        <div className="print-cta__box">
          <h2>Vamos avançar?</h2>
          <p>
            Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e formalizar a proposta definitiva.
          </p>
        </div>
      </section>

      <footer className="print-final-footer">
        <div className="print-final-footer__dates">
          <p>
            <strong>Data de emissão da proposta:</strong> {emissaoTexto}
          </p>
          <p>
            <strong>Validade da proposta:</strong> {validadeTexto} (15 dias corridos)
          </p>
        </div>
        <div className="print-final-footer__signature">
          <div className="signature-line" />
          <span>Assinatura do cliente</span>
        </div>
      </footer>

      <div className="print-brand-footer">
        <strong>SolarInvest</strong>
        <span>CNPJ: 60.434.015/0001-90</span>
        <span>{isVendaDireta ? 'Energia inteligente para o seu negócio' : 'Energia inteligente, sem desembolso'}</span>
      </div>
    </div>
  )
})

type PrintMode = 'preview' | 'print' | 'download'

type PrintVariant = 'standard' | 'simple'

type BudgetPreviewOptions = {
  nomeCliente: string
  budgetId?: string
  actionMessage?: string
  autoPrint?: boolean
  closeAfterPrint?: boolean
  initialMode?: PrintMode
  initialVariant?: PrintVariant
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
    container.style.width = '672px'
    container.style.padding = '0'
    container.style.background = '#f8fafc'
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
  Leasing: '#0C162C',
  Financiamento: '#0C162C',
}

const createEmptyKitBudget = (): KitBudgetState => ({
  items: [],
  total: null,
  totalSource: null,
  totalInput: '',
  warnings: [],
  fileName: undefined,
})

const INITIAL_ACTIVE_TAB: TabKey = 'leasing'
const INITIAL_SETTINGS_TAB: SettingsTabKey = 'mercado'
const INITIAL_UF_TARIFA = 'GO'
const INITIAL_DISTRIBUIDORA_TARIFA = 'Equatorial Goiás'
const INITIAL_MES_REAJUSTE = 6
const INITIAL_KC_KWH_MES = 0
const INITIAL_TARIFA_CHEIA = 0.964
const INITIAL_DESCONTO = 20
const INITIAL_TAXA_MINIMA = 95
const INITIAL_ENCARGOS_FIXOS_EXTRAS = 0
const INITIAL_LEASING_PRAZO: 5 | 7 | 10 = 5
const INITIAL_POTENCIA_PLACA = 550
const INITIAL_TIPO_INSTALACAO: TipoInstalacao = 'TELHADO'
const INITIAL_NUMERO_PLACAS_MANUAL: number | '' = ''
const INITIAL_PRECO_POR_KWP = 2470
const INITIAL_EFICIENCIA = 0.8
const INITIAL_DIAS_MES = DIAS_MES_PADRAO
const INITIAL_INFLACAO_AA = 8
const INITIAL_JUROS_FIN_AA = 15
const INITIAL_PRAZO_FIN_MESES = 120
const INITIAL_ENTRADA_FIN_PCT = 20
const INITIAL_MOSTRAR_FINANCIAMENTO = false
const INITIAL_MOSTRAR_GRAFICO = true
const INITIAL_PRAZO_MESES = 60
const INITIAL_BANDEIRA_ENCARGO = 0
const INITIAL_CIP_ENCARGO = 0
const INITIAL_ENTRADA_RS = 0
const INITIAL_ENTRADA_MODO: EntradaModoLabel = 'Crédito mensal'
const INITIAL_TABELA_VISIVEL = false
const INITIAL_CAPEX_MANUAL_OVERRIDE = false
const INITIAL_OEM_BASE = 35
const INITIAL_OEM_INFLACAO = 4
const INITIAL_SEGURO_MODO: SeguroModo = 'A'
const INITIAL_SEGURO_REAJUSTE = 5
const INITIAL_SEGURO_VALOR_A = 20
const INITIAL_SEGURO_PERCENTUAL_B = 0.3
const INITIAL_EXIBIR_LEASING_LINHA = true
const INITIAL_EXIBIR_FIN_LINHA = false
const INITIAL_CASHBACK_PCT = 10
const INITIAL_DEPRECIACAO_AA = 12
const INITIAL_INADIMPLENCIA_AA = 2
const INITIAL_TRIBUTOS_AA = 6
const INITIAL_IPCA_AA = 4
const INITIAL_CUSTOS_FIXOS_M = 0
const INITIAL_OPEX_M = 0
const INITIAL_SEGURO_M = 0
const INITIAL_DURACAO_MESES = 60
const INITIAL_PAGOS_ACUM_ATE_M = 0

const VENDA_FORM_DEFAULT: VendaForm = {
  consumo_kwh_mes: INITIAL_KC_KWH_MES,
  tarifa_cheia_r_kwh: INITIAL_TARIFA_CHEIA,
  inflacao_energia_aa_pct: INITIAL_INFLACAO_AA,
  taxa_minima_mensal: INITIAL_TAXA_MINIMA,
  horizonte_meses: 60,
  capex_total: 0,
  condicao: 'AVISTA',
  modo_pagamento: 'PIX',
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  entrada_financiamento: 0,
}

const createInitialVendaForm = (): VendaForm => ({ ...VENDA_FORM_DEFAULT })

const printStyles = `
  *,*::before,*::after{box-sizing:border-box;font-family:'Montserrat','Roboto',sans-serif;}
  body{margin:0;padding:0;background:#f4f6fb;color:#0c162c;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}
  h1,h2,h3{color:#0c162c;font-weight:700;}
  .print-layout{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;display:flex;flex-direction:column;gap:28px;page-break-after:avoid;}
  .print-layout>*{break-inside:avoid;page-break-inside:avoid;}
  .print-hero{position:relative;display:flex;flex-direction:column;gap:24px;padding:40px 44px;border-radius:40px;background:radial-gradient(140% 160% at 0% 0%,rgba(255,255,255,0.18) 0%,rgba(12,22,44,0) 70%),linear-gradient(135deg,#0c162c 0%,#13294c 58%,#1f3a6f 100%);color:#f8fafc;box-shadow:0 26px 60px rgba(12,22,44,0.36);overflow:hidden;}
  .print-hero,.print-section,.print-card,.print-chart,.print-cta__box{color-adjust:exact;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .print-hero,.print-hero__summary,.print-section,.print-card,.print-yearly-payments__item,.print-final-footer,.print-cta__box{break-inside:avoid;page-break-inside:avoid;}
  .print-hero::after{content:'';position:absolute;inset:auto -160px -200px auto;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at center,rgba(255,255,255,0.25),transparent 72%);opacity:0.9;}
  .print-hero__header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:32px;position:relative;z-index:1;}
  .print-hero__identity{display:flex;align-items:center;gap:28px;min-width:280px;}
  .print-logo{width:110px;height:110px;border-radius:32px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(12,22,44,0.32);backdrop-filter:blur(6px);}
  .print-logo img{width:72px;height:auto;display:block;}
  .print-hero__title{display:flex;flex-direction:column;gap:8px;}
  .print-hero__eyebrow{font-size:12px;letter-spacing:0.28em;text-transform:uppercase;font-weight:600;color:rgba(248,250,252,0.74);}
  .print-hero__title h1{margin:0;font-size:34px;line-height:1.1;color:inherit;text-shadow:0 10px 36px rgba(12,22,44,0.45);}
  .print-hero__tagline{margin:0;font-size:15px;max-width:320px;color:rgba(248,250,252,0.9);}
  .print-hero__summary{position:relative;z-index:1;padding:28px 30px;border-radius:28px;background:rgba(12,22,44,0.7);backdrop-filter:blur(6px);font-size:14px;line-height:1.6;color:rgba(248,250,252,0.94);border:1px solid rgba(255,255,255,0.12);}
  .print-hero__summary h2{margin:0 0 12px;font-size:18px;color:#f8fafc;text-transform:uppercase;letter-spacing:0.18em;}
  .print-section{background:#ffffff;border-radius:28px;padding:30px 34px;box-shadow:0 20px 44px rgba(12,22,44,0.12);border:1px solid rgba(12,22,44,0.08);page-break-inside:avoid;break-inside:avoid;}
  .print-section h2{margin:0 0 18px;font-size:22px;letter-spacing:-0.01em;color:#0c162c;position:relative;padding-bottom:8px;}
  .print-section h2::after{content:'';position:absolute;left:0;bottom:0;width:56px;height:3px;border-radius:999px;background:linear-gradient(135deg,#ff8c00,#f97316);}
  .print-client-grid{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px 28px;}
  .print-client-field{display:flex;flex-direction:column;gap:6px;}
  .print-client-field dt{margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;color:rgba(12,22,44,0.62);}
  .print-client-field dd{margin:0;font-size:13px;color:inherit;font-weight:600;line-height:1.35;}
  .print-client-field--wide{grid-column:span 2;}
  table{width:100%;border-collapse:collapse;font-size:13px;page-break-inside:avoid;break-inside:avoid;}
  th,td{border:1px solid rgba(12,22,44,0.12);padding:10px 14px;text-align:left;page-break-inside:avoid;break-inside:avoid;}
  thead,tbody,tr{page-break-inside:avoid;break-inside:avoid;}
  thead th{background:#0c162c;color:#f8fafc;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.14em;}
  tbody tr:nth-child(even){background:#f8fafc;}
  .print-key-values{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-bottom:24px;}
  .print-key-values p{margin:0;padding:18px 20px;border-radius:22px;background:rgba(12,22,44,0.03);border:1px solid rgba(12,22,44,0.1);font-size:13px;line-height:1.45;box-shadow:0 12px 26px rgba(12,22,44,0.08);}
  .print-key-values strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#0c162c;margin-bottom:6px;}
  .print-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;break-inside:auto;page-break-inside:auto;}
  .print-summary-grid>*{break-inside:avoid;page-break-inside:avoid;}
  .print-yearly-payments{display:grid;gap:16px;break-inside:auto;page-break-inside:auto;}
  .print-card{border:1px solid rgba(12,22,44,0.1);border-radius:26px;padding:26px 28px;background:linear-gradient(135deg,#f8fafc 0%,#e9eef6 100%);box-shadow:0 18px 40px rgba(12,22,44,0.14);}
  .print-card h3{margin:0 0 16px;font-size:16px;color:#0c162c;text-transform:uppercase;letter-spacing:0.14em;}
  .print-card .muted{margin:12px 0 0;}
  .print-subheading{margin:26px 0 12px;font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#0c162c;}
  .print-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:0 0 18px;}
  .print-kpi{padding:18px 20px;border-radius:20px;background:rgba(12,22,44,0.05);border:1px solid rgba(12,22,44,0.12);box-shadow:0 10px 24px rgba(12,22,44,0.12);}
  .print-kpi span{display:block;margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(12,22,44,0.66);}
  .print-kpi strong{display:block;font-size:20px;color:#0c162c;}
  .print-metric-list p{margin:0 0 10px;font-size:13px;}
  .print-chart-section{display:flex;flex-direction:column;gap:18px;}
  .print-chart{position:relative;padding:24px 28px;border-radius:28px;border:1px solid rgba(15,23,42,0.16);background:linear-gradient(155deg,rgba(255,255,255,0.98) 0%,rgba(226,232,240,0.9) 48%,rgba(248,250,252,0.95) 100%);box-shadow:0 22px 48px rgba(15,23,42,0.18);}
  .print-chart::after{content:'';position:absolute;inset:14px 14px auto auto;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at center,rgba(255,140,0,0.22),transparent 72%);opacity:0.85;}
  .print-chart .recharts-responsive-container{width:100%!important;height:320px!important;margin:0 auto;}
  .print-chart svg{overflow:visible;}
  .print-chart .recharts-cartesian-axis-line,.print-chart .recharts-cartesian-axis-tick-line{stroke:rgba(15,23,42,0.28);}
  .print-chart .recharts-cartesian-axis-tick text{fill:#0f172a;font-size:12px;font-weight:600;}
  .print-chart .recharts-legend-wrapper{padding-top:0!important;}
  .print-chart .recharts-legend-item text{fill:#0f172a;font-weight:700;font-size:12px;letter-spacing:0.02em;}
  .print-chart .recharts-cartesian-grid line{stroke:#cbd5f5;}
  .print-chart .recharts-tooltip-wrapper{display:none!important;}
  .print-chart-highlights{margin:18px 0 0;padding:0;list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));}
  .print-chart-highlights li{background:rgba(255,255,255,0.85);border:1px solid rgba(148,163,184,0.38);border-radius:18px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;}
  .print-chart-highlights__year{font-size:12px;font-weight:700;color:#0f172a;letter-spacing:0.08em;text-transform:uppercase;}
  .print-chart-highlights__values{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;line-height:1.3;}
  .print-chart-highlights__value{display:inline-flex;align-items:center;gap:4px;}
  .chart-title{margin:0;font-size:18px;color:#0c162c;text-transform:uppercase;letter-spacing:0.18em;}
  .chart-explainer{margin:18px 0 0;background:rgba(15,23,42,0.06);padding:14px 18px;border-radius:20px;border:1px solid rgba(15,23,42,0.18);font-size:13px;color:#0f172a;line-height:1.55;}
  .chart-explainer strong{font-size:14px;color:#0c162c;}
  .print-chart-footnote{margin:10px 0 0;font-size:12px;color:#475569;}
  ul{margin:0;padding-left:20px;font-size:13px;color:#1f2937;line-height:1.55;}
  ul li{margin-bottom:8px;}
  .print-cta{padding:0;border:none;background:none;box-shadow:none;}
  .print-cta__box{border-radius:30px;background:linear-gradient(135deg,#e2e8f0 0%,#cbd5f5 100%);padding:32px 36px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;border:1px solid rgba(12,22,44,0.12);box-shadow:0 18px 42px rgba(12,22,44,0.18);}
  .print-cta__box h2{margin:0;font-size:24px;color:#0c162c;letter-spacing:0.08em;text-transform:uppercase;}
  .print-cta__box p{margin:0;font-size:15px;color:#1e293b;}
  .print-final-footer{display:flex;flex-wrap:wrap;gap:28px;justify-content:space-between;align-items:flex-start;background:#ffffff;border-radius:28px;padding:30px 34px;box-shadow:0 22px 46px rgba(12,22,44,0.14);page-break-inside:avoid;}
  .print-final-footer__dates{display:flex;flex-direction:column;gap:10px;font-size:13px;color:#1f2937;}
  .print-final-footer__dates strong{color:#0c162c;}
  .print-final-footer__signature{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:240px;}
  .signature-line{width:100%;height:1px;background:#cbd5f5;margin-top:28px;}
  .print-final-footer__signature span{font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#475569;}
  .print-brand-footer{display:flex;justify-content:center;align-items:center;gap:10px;font-size:12px;color:#0c162c;text-transform:uppercase;letter-spacing:0.24em;padding-bottom:18px;}
  .print-brand-footer strong{color:#ff8c00;}
  .muted{text-align:center;color:#64748b;font-size:12px;padding:20px 12px;}
  .print-yearly-payments{display:grid;gap:16px;break-inside:auto;page-break-inside:auto;}
  .print-yearly-payments__item{display:flex;flex-direction:column;gap:12px;padding:20px 22px;border-radius:22px;background:rgba(12,22,44,0.04);border:1px solid rgba(12,22,44,0.12);box-shadow:0 12px 26px rgba(12,22,44,0.12);}
  .print-yearly-payments__header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;}
  .print-yearly-payments__year-label{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(12,22,44,0.6);}
  .print-yearly-payments__year{font-size:22px;font-weight:700;color:#ff8c00;text-transform:uppercase;}
  .print-yearly-payments__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px 18px;margin:4px 0 0;}
  .print-yearly-payments__metrics div{display:flex;flex-direction:column;gap:4px;}
  .print-yearly-payments__metrics dt{margin:0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(12,22,44,0.55);}
  .print-yearly-payments__metrics dd{margin:0;font-size:14px;font-weight:600;color:#0c162c;}
  .print-yearly-payments__empty{margin:0;font-size:13px;color:#475569;}
  html[data-print-mode='print'],body[data-print-mode='print']{background:#ffffff;color:#0f172a;}
  html[data-print-mode='print'] .print-layout{background:none;}
  html[data-print-mode='print'] .print-hero{background:#ffffff;color:#0f172a;box-shadow:none;border:1px solid rgba(15,23,42,0.22);}
  html[data-print-mode='print'] .print-hero::after{display:none;}
  html[data-print-mode='print'] .print-logo{background:#f1f5f9;border:1px solid rgba(15,23,42,0.12);box-shadow:none;}
  html[data-print-mode='print'] .print-logo img{filter:grayscale(100%);opacity:0.85;}
  html[data-print-mode='print'] .print-hero__eyebrow{color:#1f2937;}
  html[data-print-mode='print'] .print-hero__title h1{text-shadow:none;color:#0f172a;}
  html[data-print-mode='print'] .print-hero__tagline{color:#1f2937;}
  html[data-print-mode='print'] .print-hero__summary{background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-hero__summary h2{color:#0f172a;}
  html[data-print-mode='print'] .print-section{background:#ffffff;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-section h2{color:#0f172a;}
  html[data-print-mode='print'] .print-section h2::after{background:#0f172a;}
  html[data-print-mode='print'] .print-key-values p{background:#ffffff;border:1px solid rgba(15,23,42,0.16);box-shadow:none;}
  html[data-print-mode='print'] .print-card{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-card h3{color:#0f172a;}
  html[data-print-mode='print'] .print-cta__box{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-final-footer{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-final-footer__dates strong{color:#0f172a;}
  html[data-print-mode='print'] .print-brand-footer{color:#0f172a;}
  html[data-print-mode='print'] .print-brand-footer strong{color:#0f172a;}
  html[data-print-mode='print'] .print-yearly-payments__item{background:#ffffff;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-yearly-payments__year{color:#0f172a;}
  html[data-print-mode='print'] .print-yearly-payments__year-label{color:#0f172a;}
  html[data-print-mode='print'] .print-chart{background:#ffffff;border:1px solid rgba(15,23,42,0.24);box-shadow:none;}
  html[data-print-mode='print'] .print-chart::after{display:none;}
  html[data-print-mode='download'] .print-chart::after{display:none;}
  html[data-print-mode='print'] .print-chart .recharts-legend-item text{fill:#0f172a;}
  html[data-print-mode='print'] .chart-title{color:#0f172a;}
  html[data-print-mode='print'] .chart-explainer{background:#ffffff;border:1px solid rgba(15,23,42,0.24);color:#0f172a;}
  html[data-print-mode='print'] .chart-explainer strong{color:#0f172a;}
  html[data-print-mode='print'] .print-chart-highlights li{background:#ffffff;border:1px solid rgba(15,23,42,0.26);}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-line,
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-tick-line{stroke:#475569;}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-tick text{fill:#0f172a;}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-grid line{stroke:#94a3b8;}
  html[data-print-mode='print'] .print-chart svg{filter:grayscale(100%) contrast(1.15);}
  html[data-print-mode='print'] thead th{background:#0f172a;color:#ffffff;}
  html[data-print-mode='print'] tbody tr:nth-child(even){background:#ffffff;}
  html[data-print-mode='print'] .muted{color:#1f2937;}
  @page{size:A4;margin:12mm 16mm;}
`;


const simplePrintStyles = `
  [data-print-variant='simple'] *,[data-print-variant='simple'] *::before,[data-print-variant='simple'] *::after{box-sizing:border-box;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif!important;color:#000!important;text-shadow:none!important;}
  [data-print-variant='simple'] body{margin:0;padding:0;background:#fff!important;color:#000!important;font-size:12px;line-height:1.5;}
  [data-print-variant='simple'] h1,[data-print-variant='simple'] h2,[data-print-variant='simple'] h3{color:#000!important;font-weight:700;}
  [data-print-variant='simple'] .print-layout{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding:0 0 24px;}
  [data-print-variant='simple'] .print-layout>*{page-break-inside:avoid;break-inside:avoid;}
  [data-print-variant='simple'] .print-hero{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:24px 28px;color:#000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .print-hero::after{display:none!important;}
  [data-print-variant='simple'] .print-hero__identity{gap:16px;}
  [data-print-variant='simple'] .print-logo{background:none!important;border:none!important;box-shadow:none!important;width:88px;height:88px;padding:0;}
  [data-print-variant='simple'] .print-logo img{max-width:72px;height:auto;filter:grayscale(100%) contrast(1.15);}
  [data-print-variant='simple'] .print-hero__eyebrow{font-size:11px;letter-spacing:0.18em;color:#000!important;}
  [data-print-variant='simple'] .print-hero__title h1{font-size:24px;}
  [data-print-variant='simple'] .print-hero__tagline{color:#000!important;font-size:12px;}
  [data-print-variant='simple'] .print-hero__summary{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:20px 24px;color:#000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .print-hero__summary h2{font-size:16px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-section{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:20px 24px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-section h2{margin:0 0 16px;font-size:18px;padding-bottom:0;border-bottom:1px solid #000;}
  [data-print-variant='simple'] .print-section h2::after{display:none!important;}
  [data-print-variant='simple'] .print-client-grid{gap:12px 18px;}
  [data-print-variant='simple'] .print-client-field dt{font-size:10px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-client-field dd{font-size:12px;}
  [data-print-variant='simple'] table{font-size:12px;border-collapse:collapse;}
  [data-print-variant='simple'] th,[data-print-variant='simple'] td{border:1px solid #000!important;padding:8px 10px;text-align:left;}
  [data-print-variant='simple'] thead th{background:#f0f0f0!important;color:#000!important;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;}
  [data-print-variant='simple'] tbody tr:nth-child(even){background:#fff!important;}
  [data-print-variant='simple'] .print-key-values{gap:12px;}
  [data-print-variant='simple'] .print-key-values p{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;font-size:12px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-key-values strong{font-size:10px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-summary-grid{gap:16px;}
  [data-print-variant='simple'] .print-card{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:16px 18px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-card h3{font-size:14px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-subheading{margin:16px 0 6px;font-size:12px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-kpi-grid{gap:10px;}
  [data-print-variant='simple'] .print-kpi{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-kpi span{font-size:10px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-kpi strong{font-size:16px;}
  [data-print-variant='simple'] .print-yearly-payments__item{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:14px 16px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-yearly-payments__header{align-items:center;}
  [data-print-variant='simple'] .print-yearly-payments__year{color:#000!important;font-size:18px;}
  [data-print-variant='simple'] .print-yearly-payments__year-label{color:#000!important;font-size:10px;}
  [data-print-variant='simple'] .print-yearly-payments__metrics dd{font-size:12px;}
  [data-print-variant='simple'] .print-chart{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:16px 18px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-chart::after{display:none!important;}
  [data-print-variant='simple'] .print-chart svg{filter:grayscale(100%) contrast(1.2)!important;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-grid line{stroke:#000!important;stroke-opacity:0.18;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-axis-line,[data-print-variant='simple'] .print-chart .recharts-cartesian-axis-tick-line{stroke:#000!important;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-axis-tick text,[data-print-variant='simple'] .print-chart .recharts-legend-item text{fill:#000!important;font-weight:600;}
  [data-print-variant='simple'] .print-chart-highlights{gap:10px;}
  [data-print-variant='simple'] .print-chart-highlights li{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:10px 12px;}
  [data-print-variant='simple'] .print-chart-highlights__year{font-size:11px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-chart-highlights__values{font-size:11px;}
  [data-print-variant='simple'] .chart-title{color:#000!important;font-size:16px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .chart-explainer{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;color:#000!important;}
  [data-print-variant='simple'] .chart-explainer strong{color:#000!important;}
  [data-print-variant='simple'] .print-chart-footnote{color:#000!important;}
  [data-print-variant='simple'] ul{color:#000!important;font-size:12px;line-height:1.5;}
  [data-print-variant='simple'] .print-cta__box{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:18px 20px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-final-footer{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:18px 20px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-final-footer__dates strong{color:#000!important;}
  [data-print-variant='simple'] .print-final-footer__signature span{font-size:11px;letter-spacing:0.12em;color:#000!important;}
  [data-print-variant='simple'] .signature-line{background:#000!important;height:1px;}
  [data-print-variant='simple'] .print-brand-footer{color:#000!important;letter-spacing:0.18em;}
  [data-print-variant='simple'] .print-brand-footer strong{color:#000!important;}
  [data-print-variant='simple'] .muted{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar{background:#fff!important;border-bottom:1px solid #000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .preview-toolbar-info h1{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-info p{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-code strong{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button{background:#0f172a;color:#fff;border:none;padding:8px 16px;font-size:13px;font-weight:600;border-radius:4px;}
  [data-print-variant='simple'] .preview-toolbar-actions button.secondary{background:#f4f4f4!important;color:#000!important;border:1px solid #000!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button.secondary:hover{background:#e5e5e5!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button:hover{filter:none;}
  @media print{
    [data-print-variant='simple'] body{padding-top:0;}
    [data-print-variant='simple'] .preview-toolbar{display:none!important;}
  }
`;


export default function App() {
  const distribuidorasFallback = useMemo(() => getDistribuidorasFallback(), [])
  const [activePage, setActivePage] = useState<'app' | 'crm'>('app')
  const [activeTab, setActiveTab] = useState<TabKey>(INITIAL_ACTIVE_TAB)
  const isVendaDiretaTab = activeTab === 'vendas'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isBudgetSearchOpen, setIsBudgetSearchOpen] = useState(false)
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [orcamentoSearchTerm, setOrcamentoSearchTerm] = useState('')
  const [currentBudgetId, setCurrentBudgetId] = useState<string | undefined>(undefined)
  const budgetUploadInputId = useId()
  const budgetUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [kitBudget, setKitBudget] = useState<KitBudgetState>(() => createEmptyKitBudget())
  const [isBudgetProcessing, setIsBudgetProcessing] = useState(false)
  const [budgetProcessingError, setBudgetProcessingError] = useState<string | null>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>(INITIAL_SETTINGS_TAB)
  const mesReferenciaRef = useRef(new Date().getMonth() + 1)
  const [ufTarifa, setUfTarifa] = useState(INITIAL_UF_TARIFA)
  const [distribuidoraTarifa, setDistribuidoraTarifa] = useState(INITIAL_DISTRIBUIDORA_TARIFA)
  const [ufsDisponiveis, setUfsDisponiveis] = useState<string[]>(() => [...distribuidorasFallback.ufs])
  const [distribuidorasPorUf, setDistribuidorasPorUf] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      Object.entries(distribuidorasFallback.distribuidorasPorUf).map(([uf, lista]) => [
        uf,
        [...lista],
      ]),
    ),
  )
  const [mesReajuste, setMesReajuste] = useState(INITIAL_MES_REAJUSTE)

  const [kcKwhMes, setKcKwhMes] = useState(INITIAL_KC_KWH_MES)
  const [tarifaCheia, setTarifaCheia] = useState(INITIAL_TARIFA_CHEIA)
  const [desconto, setDesconto] = useState(INITIAL_DESCONTO)
  const [taxaMinima, setTaxaMinima] = useState(INITIAL_TAXA_MINIMA)
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(INITIAL_ENCARGOS_FIXOS_EXTRAS)
  const [leasingPrazo, setLeasingPrazo] = useState<5 | 7 | 10>(INITIAL_LEASING_PRAZO)
  const [potenciaPlaca, setPotenciaPlaca] = useState(INITIAL_POTENCIA_PLACA)
  const [tipoInstalacao, setTipoInstalacao] = useState<TipoInstalacao>(INITIAL_TIPO_INSTALACAO)
  const [numeroPlacasManual, setNumeroPlacasManual] = useState<number | ''>(INITIAL_NUMERO_PLACAS_MANUAL)
  const consumoAnteriorRef = useRef(kcKwhMes)

  const [cliente, setCliente] = useState<ClienteDados>({ ...CLIENTE_INICIAL })
  const [clientesSalvos, setClientesSalvos] = useState<ClienteRegistro[]>([])
  const [clienteEmEdicaoId, setClienteEmEdicaoId] = useState<string | null>(null)
  const [isClientesModalOpen, setIsClientesModalOpen] = useState(false)
  const [clienteMensagens, setClienteMensagens] = useState<ClienteMensagens>({})
  const [verificandoCidade, setVerificandoCidade] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const notificacaoSequencialRef = useRef(0)
  const notificacaoTimeoutsRef = useRef<Record<number, number>>({})

  const [crmIntegrationMode, setCrmIntegrationMode] = useState<CrmIntegrationMode>('local')
  const crmIntegrationModeRef = useRef<CrmIntegrationMode>(crmIntegrationMode)
  const [crmIsSaving, setCrmIsSaving] = useState(false)
  const [crmBackendStatus, setCrmBackendStatus] = useState<CrmBackendStatus>('idle')
  const [crmBackendError, setCrmBackendError] = useState<string | null>(null)
  const [crmLastSync, setCrmLastSync] = useState<Date | null>(null)
  const [crmBusca, setCrmBusca] = useState('')
  const [crmFiltroOperacao, setCrmFiltroOperacao] = useState<CrmFiltroOperacao>('all')
  const [crmLeadSelecionadoId, setCrmLeadSelecionadoId] = useState<string | null>(null)
  const [crmLeadForm, setCrmLeadForm] = useState<CrmLeadFormState>({ ...CRM_EMPTY_LEAD_FORM })
  const [crmNotaTexto, setCrmNotaTexto] = useState('')
  const [crmDataset, setCrmDataset] = useState<CrmDataset>(() => carregarDatasetCrm())
  const [crmLancamentoForm, setCrmLancamentoForm] = useState({
    dataIso: new Date().toISOString().slice(0, 10),
    categoria: 'Receita' as CrmLancamentoCaixa['categoria'],
    origem: 'Leasing',
    formaPagamento: 'Pix' as CrmLancamentoCaixa['formaPagamento'],
    tipo: 'entrada' as CrmLancamentoCaixa['tipo'],
    valor: '',
    leadId: '' as string,
    observacao: '',
  })
  const [crmCustosForm, setCrmCustosForm] = useState({
    equipamentos: '',
    maoDeObra: '',
    deslocamento: '',
    taxasSeguros: '',
  })
  const [crmContratoForm, setCrmContratoForm] = useState({
    leadId: '' as string,
    modelo: 'LEASING' as 'LEASING' | 'VENDA_DIRETA',
    valorTotal: '',
    entrada: '',
    parcelas: '36',
    valorParcela: '',
    reajusteAnualPct: '3',
    vencimentoInicialIso: new Date().toISOString().slice(0, 10),
    status: 'em-aberto' as CrmFinanceiroStatus,
  })
  const [crmManutencaoForm, setCrmManutencaoForm] = useState({
    leadId: '' as string,
    dataIso: new Date().toISOString().slice(0, 10),
    tipo: 'Revisão preventiva',
    observacao: '',
  })
  const [capexManualOverride, setCapexManualOverride] = useState(INITIAL_CAPEX_MANUAL_OVERRIDE)

  const budgetItemsTotal = useMemo(
    () => computeBudgetItemsTotalValue(kitBudget.items),
    [kitBudget.items],
  )

  useEffect(() => {
    if (kitBudget.totalSource !== 'calculated') {
      return
    }
    const nextTotal = budgetItemsTotal
    const formatted = formatCurrencyInputValue(nextTotal)
    if (numbersAreClose(nextTotal, kitBudget.total) && formatted === kitBudget.totalInput) {
      return
    }
    setKitBudget((prev) => ({
      ...prev,
      total: nextTotal,
      totalInput: formatted,
    }))
  }, [budgetItemsTotal, kitBudget.totalSource, kitBudget.total, kitBudget.totalInput])

  const updateKitBudgetItem = useCallback(
    (itemId: string, updater: (item: KitBudgetItemState) => KitBudgetItemState) => {
      setKitBudget((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? updater(item) : item)),
      }))
    },
    [],
  )

  const handleBudgetItemTextChange = useCallback(
    (itemId: string, field: 'productName' | 'description', value: string) => {
      updateKitBudgetItem(itemId, (item) => ({ ...item, [field]: value }))
    },
    [updateKitBudgetItem],
  )

  const handleBudgetItemQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const parsed = parseNumericInput(value)
      updateKitBudgetItem(itemId, (item) => ({
        ...item,
        quantity: parsed,
        quantityInput: value,
      }))
    },
    [updateKitBudgetItem],
  )

  const handleBudgetItemUnitPriceChange = useCallback(
    (itemId: string, value: string) => {
      const parsed = parseNumericInput(value)
      updateKitBudgetItem(itemId, (item) => ({
        ...item,
        unitPrice: normalizeCurrencyNumber(parsed),
        unitPriceInput: value,
      }))
    },
    [updateKitBudgetItem],
  )

  const handleRemoveBudgetItem = useCallback((itemId: string) => {
    setKitBudget((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }))
  }, [])

  const handleAddBudgetItem = useCallback(() => {
    const baseId = Date.now().toString(36)
    setKitBudget((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `manual-${baseId}-${prev.items.length + 1}`,
          productName: '',
          description: '',
          quantity: null,
          quantityInput: '',
          unitPrice: null,
          unitPriceInput: '',
        },
      ],
    }))
  }, [])

  const handleBudgetTotalChange = useCallback(
    (value: string) => {
      setKitBudget((prev) => {
        const trimmed = value.trim()
        if (!trimmed) {
          return {
            ...prev,
            totalInput: '',
            total: budgetItemsTotal,
            totalSource: budgetItemsTotal !== null ? 'calculated' : null,
          }
        }
        const parsed = normalizeCurrencyNumber(parseNumericInput(trimmed))
        return {
          ...prev,
          totalInput: value,
          total: parsed,
          totalSource: trimmed ? 'explicit' : prev.totalSource,
        }
      })
    },
    [budgetItemsTotal],
  )

  const validateVendaForm = useCallback((form: VendaForm) => {
    const errors: Record<string, string> = {}

    if (!Number.isFinite(form.consumo_kwh_mes) || form.consumo_kwh_mes <= 0) {
      errors.consumo_kwh_mes = 'Informe o consumo mensal em kWh.'
    }
    if (!Number.isFinite(form.tarifa_cheia_r_kwh) || form.tarifa_cheia_r_kwh <= 0) {
      errors.tarifa_cheia_r_kwh = 'Informe a tarifa cheia válida.'
    }
    if (!Number.isFinite(form.taxa_minima_mensal) || form.taxa_minima_mensal < 0) {
      errors.taxa_minima_mensal = 'A taxa mínima deve ser zero ou positiva.'
    }
    if (!Number.isFinite(form.horizonte_meses) || form.horizonte_meses <= 0) {
      errors.horizonte_meses = 'Informe o horizonte em meses.'
    }
    if (!Number.isFinite(form.capex_total) || form.capex_total <= 0) {
      errors.capex_total = 'Informe o investimento total (CAPEX).'
    }

    const condicao = form.condicao
    if (!condicao) {
      errors.condicao = 'Selecione a condição de pagamento.'
    }

    const ensurePercent = (value: number | undefined, field: keyof VendaForm) => {
      if (value === undefined || value === null) {
        return
      }
      if (!Number.isFinite(value) || value < 0) {
        errors[field as string] = 'Use valores maiores ou iguais a zero.'
        return
      }
      if (value > 1) {
        errors[field as string] = 'Use valores entre 0 e 1.'
      }
    }

    ensurePercent(form.taxa_mdr_pix_pct, 'taxa_mdr_pix_pct')
    ensurePercent(form.taxa_mdr_debito_pct, 'taxa_mdr_debito_pct')
    ensurePercent(form.taxa_mdr_credito_vista_pct, 'taxa_mdr_credito_vista_pct')
    ensurePercent(form.taxa_mdr_credito_parcelado_pct, 'taxa_mdr_credito_parcelado_pct')

    if (condicao === 'AVISTA') {
      if (!form.modo_pagamento) {
        errors.modo_pagamento = 'Selecione o modo de pagamento.'
      }
    } else if (condicao === 'PARCELADO') {
      const parcelas = Number.isFinite(form.n_parcelas) ? Number(form.n_parcelas) : 0
      if (!parcelas || parcelas <= 0) {
        errors.n_parcelas = 'Informe o número de parcelas.'
      }
      const jurosAm = Number.isFinite(form.juros_cartao_am_pct) ? Number(form.juros_cartao_am_pct) : null
      const jurosAa = Number.isFinite(form.juros_cartao_aa_pct) ? Number(form.juros_cartao_aa_pct) : null
      if ((jurosAm === null || jurosAm < 0) && (jurosAa === null || jurosAa < 0)) {
        errors.juros_cartao_am_pct = 'Informe os juros a.m. ou a.a.'
        errors.juros_cartao_aa_pct = 'Informe os juros a.m. ou a.a.'
      }
      if (jurosAm !== null && jurosAm < 0) {
        errors.juros_cartao_am_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (jurosAa !== null && jurosAa < 0) {
        errors.juros_cartao_aa_pct = 'Os juros devem ser zero ou positivos.'
      }
    } else if (condicao === 'FINANCIAMENTO') {
      const parcelasFin = Number.isFinite(form.n_parcelas_fin) ? Number(form.n_parcelas_fin) : 0
      if (!parcelasFin || parcelasFin <= 0) {
        errors.n_parcelas_fin = 'Informe as parcelas do financiamento.'
      }
      const jurosAm = Number.isFinite(form.juros_fin_am_pct) ? Number(form.juros_fin_am_pct) : null
      const jurosAa = Number.isFinite(form.juros_fin_aa_pct) ? Number(form.juros_fin_aa_pct) : null
      if ((jurosAm === null || jurosAm < 0) && (jurosAa === null || jurosAa < 0)) {
        errors.juros_fin_am_pct = 'Informe os juros a.m. ou a.a.'
        errors.juros_fin_aa_pct = 'Informe os juros a.m. ou a.a.'
      }
      if (jurosAm !== null && jurosAm < 0) {
        errors.juros_fin_am_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (jurosAa !== null && jurosAa < 0) {
        errors.juros_fin_aa_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (
        Number.isFinite(form.entrada_financiamento) &&
        (form.entrada_financiamento ?? 0) < 0
      ) {
        errors.entrada_financiamento = 'A entrada deve ser zero ou positiva.'
      }
    }

    if (
      Number.isFinite(form.taxa_desconto_aa_pct) &&
      (form.taxa_desconto_aa_pct ?? 0) < 0
    ) {
      errors.taxa_desconto_aa_pct = 'A taxa de desconto deve ser zero ou positiva.'
    }

    return errors
  }, [])

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteUf = cliente.uf
  const clienteDistribuidora = cliente.distribuidora
  const clienteDistribuidorasDisponiveis = useMemo(() => {
    if (!clienteUf) return [] as string[]
    return distribuidorasPorUf[clienteUf] ?? []
  }, [clienteUf, distribuidorasPorUf])

  const [precoPorKwp, setPrecoPorKwp] = useState(INITIAL_PRECO_POR_KWP)
  const [irradiacao, setIrradiacao] = useState(IRRADIACAO_FALLBACK)
  const [eficiencia, setEficiencia] = useState(INITIAL_EFICIENCIA)
  const [diasMes, setDiasMes] = useState(INITIAL_DIAS_MES)
  const [inflacaoAa, setInflacaoAa] = useState(INITIAL_INFLACAO_AA)

  const [vendaForm, setVendaForm] = useState<VendaForm>(() => createInitialVendaForm())
  const [vendaFormErrors, setVendaFormErrors] = useState<Record<string, string>>({})
  const [retornoProjetado, setRetornoProjetado] = useState<RetornoProjetado | null>(null)
  const [retornoStatus, setRetornoStatus] = useState<'idle' | 'calculating'>('idle')
  const [retornoError, setRetornoError] = useState<string | null>(null)

  const resetRetorno = useCallback(() => {
    setRetornoProjetado(null)
    setRetornoError(null)
    setRetornoStatus('idle')
  }, [])

  const handleCalcularRetorno = useCallback(() => {
    const errors = validateVendaForm(vendaForm)
    setVendaFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      setRetornoError('Revise os campos destacados antes de calcular o retorno.')
      setRetornoProjetado(null)
      setRetornoStatus('idle')
      return
    }
    try {
      setRetornoStatus('calculating')
      const resultado = computeROI(vendaForm)
      setRetornoProjetado(resultado)
      setRetornoError(null)
    } catch (error) {
      console.error('Erro ao calcular retorno projetado.', error)
      setRetornoProjetado(null)
      setRetornoError('Não foi possível calcular o retorno. Tente novamente.')
    } finally {
      setRetornoStatus('idle')
    }
  }, [validateVendaForm, vendaForm])

  const applyVendaUpdates = useCallback(
    (updates: Partial<VendaForm>) => {
      if (!updates || Object.keys(updates).length === 0) {
        return
      }
      setVendaForm((prev) => {
        let changed = false
        const next: VendaForm = { ...prev }
        Object.entries(updates).forEach(([rawKey, value]) => {
          const key = rawKey as keyof VendaForm
          if (value === undefined) {
            if (next[key] !== undefined) {
              ;(next as any)[key] = value
              changed = true
            }
            return
          }
          if (next[key] !== value) {
            ;(next as any)[key] = value
            changed = true
          }
        })
        return changed ? next : prev
      })
      setVendaFormErrors((prev) => {
        if (!prev || Object.keys(prev).length === 0) {
          return prev
        }
        let changed = false
        const next = { ...prev }
        Object.keys(updates).forEach((key) => {
          if (key in next) {
            delete next[key]
            changed = true
          }
        })
        return changed ? next : prev
      })
      resetRetorno()
    },
    [resetRetorno],
  )

  const autoFillVendaFromBudget = useCallback(
    (structured: StructuredBudget, totalValue?: number | null) => {
      if (!structured) {
        return
      }

      const moduloKeywords = ['modulo', 'módulo', 'placa', 'painel']
      const inversorKeywords = ['inversor']
      const estruturaKeywords = ['estrutura', 'fixacao', 'fixação', 'suporte', 'trilho', 'perfil']

      let quantidadeModulos: number | undefined
      let modeloModulo: string | undefined
      let modeloInversor: string | undefined
      let potenciaInstalada: number | undefined
      let geracaoEstimada: number | undefined
      let estruturaSuporte: string | undefined

      structured.itens.forEach((item) => {
        const descricaoCompleta = `${item.produto ?? ''} ${item.modelo ?? ''} ${item.descricao ?? ''}`
        const textoNormalizado = normalizeText(descricaoCompleta)

        const quantidadeItem = Number.isFinite(item.quantidade) ? Number(item.quantidade) : null
        if (quantidadeItem && quantidadeItem > 0) {
          if (moduloKeywords.some((palavra) => textoNormalizado.includes(palavra))) {
            quantidadeModulos = (quantidadeModulos ?? 0) + quantidadeItem
            if (!modeloModulo) {
              modeloModulo = item.modelo?.trim() || item.produto?.trim() || undefined
            }
          }
          if (!modeloInversor && inversorKeywords.some((palavra) => textoNormalizado.includes(palavra))) {
            modeloInversor = item.modelo?.trim() || item.produto?.trim() || undefined
          }
          if (!estruturaSuporte && estruturaKeywords.some((palavra) => textoNormalizado.includes(palavra))) {
            const candidato = item.modelo?.trim() || item.produto?.trim() || item.descricao?.trim() || ''
            const limpado = candidato.replace(/^[-–—\s]+/, '')
            if (limpado && limpado !== '—') {
              estruturaSuporte = limpado
            }
          }
        }

        if (!potenciaInstalada) {
          const potenciaMatch = descricaoCompleta.match(/(\d+(?:[.,]\d+)?)\s*k(?:wp|w)\b/i)
          if (potenciaMatch) {
            const valor = Number.parseFloat(potenciaMatch[1].replace(',', '.'))
            if (Number.isFinite(valor) && valor > 0) {
              potenciaInstalada = valor
            }
          }
        }

        if (!geracaoEstimada) {
          const geracaoMatch = descricaoCompleta.match(/(\d+(?:[.,]\d+)?)\s*kwh/i)
          if (geracaoMatch) {
            const valor = Number.parseFloat(geracaoMatch[1].replace(',', '.'))
            if (Number.isFinite(valor) && valor > 0) {
              geracaoEstimada = valor
            }
          }
        }
      })

      if (!potenciaInstalada && quantidadeModulos && potenciaPlaca > 0) {
        potenciaInstalada = (quantidadeModulos * potenciaPlaca) / 1000
      }

      const updates: Partial<VendaForm> = {}
      if (typeof quantidadeModulos === 'number' && quantidadeModulos > 0) {
        updates.quantidade_modulos = quantidadeModulos
      }
      if (modeloModulo) {
        updates.modelo_modulo = modeloModulo
      }
      if (modeloInversor) {
        updates.modelo_inversor = modeloInversor
      }
      if (estruturaSuporte) {
        updates.estrutura_suporte = estruturaSuporte
      }
      if (typeof potenciaInstalada === 'number' && potenciaInstalada > 0) {
        updates.potencia_instalada_kwp = potenciaInstalada
      }
      if (typeof geracaoEstimada === 'number' && geracaoEstimada > 0) {
        updates.geracao_estimada_kwh_mes = geracaoEstimada
      }
      const numeroOrcamento = structured.header.numeroOrcamento?.trim()
      if (numeroOrcamento) {
        updates.numero_orcamento_vendor = numeroOrcamento
      }

      if (typeof totalValue === 'number' && Number.isFinite(totalValue) && totalValue > 0) {
        updates.capex_total = totalValue
        setCapexManualOverride(false)
      }

      if (Object.keys(updates).length > 0) {
        applyVendaUpdates(updates)
      }
    },
    [applyVendaUpdates, potenciaPlaca],
  )

  const handleCondicaoPagamentoChange = useCallback(
    (nextCondicao: PagamentoCondicao) => {
      const updates: Partial<VendaForm> = { condicao: nextCondicao }
      if (nextCondicao === 'AVISTA') {
        updates.modo_pagamento = vendaForm.modo_pagamento ?? 'PIX'
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
      } else if (nextCondicao === 'PARCELADO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
      } else if (nextCondicao === 'FINANCIAMENTO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
      }
      applyVendaUpdates(updates)
    },
    [applyVendaUpdates, vendaForm.modo_pagamento],
  )

  const handleBudgetFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }
      setBudgetProcessingError(null)
      setIsBudgetProcessing(true)
      try {
        const buffer = await file.arrayBuffer()
        const extraction = await extractBudgetFromPdf(buffer)
        const timestamp = Date.now().toString(36)
        const extractedItems: KitBudgetItemState[] = extraction.items.map((item, index) => {
          const quantity =
            typeof item.quantity === 'number' && Number.isFinite(item.quantity)
              ? item.quantity
              : null
          const unitPriceRaw =
            typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)
              ? item.unitPrice
              : null
          const unitPrice = normalizeCurrencyNumber(unitPriceRaw)
          return {
            id: `pdf-${timestamp}-${index}`,
            productName: item.productName ?? '',
            description: item.description ?? '',
            quantity,
            quantityInput: formatQuantityInputValue(quantity),
            unitPrice,
            unitPriceInput: formatCurrencyInputValue(unitPrice),
          }
        })
        setKitBudget({
          items: extractedItems,
          total: extraction.total ?? null,
          totalSource: extraction.totalSource ?? null,
          totalInput: formatCurrencyInputValue(extraction.total ?? null),
          warnings: extraction.warnings ?? [],
          fileName: file.name,
        })
        const numeroOrcamento = extraction.structuredBudget.header.numeroOrcamento?.trim()
        if (numeroOrcamento) {
          setCurrentBudgetId(numeroOrcamento)
        }
        autoFillVendaFromBudget(extraction.structuredBudget, extraction.total ?? null)
      } catch (error) {
        console.error('Erro ao processar orçamento em PDF', error)
        setBudgetProcessingError(
          'Não foi possível processar o PDF. Verifique o arquivo e tente novamente.',
        )
      } finally {
        setIsBudgetProcessing(false)
        if (budgetUploadInputRef.current) {
          budgetUploadInputRef.current.value = ''
        }
      }
    },
    [autoFillVendaFromBudget],
  )

  const [jurosFinAa, setJurosFinAa] = useState(INITIAL_JUROS_FIN_AA)
  const [prazoFinMeses, setPrazoFinMeses] = useState(INITIAL_PRAZO_FIN_MESES)
  const [entradaFinPct, setEntradaFinPct] = useState(INITIAL_ENTRADA_FIN_PCT)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(INITIAL_MOSTRAR_FINANCIAMENTO)
  const [mostrarGrafico, setMostrarGrafico] = useState(INITIAL_MOSTRAR_GRAFICO)

  const [prazoMeses, setPrazoMeses] = useState(INITIAL_PRAZO_MESES)
  const [bandeiraEncargo, setBandeiraEncargo] = useState(INITIAL_BANDEIRA_ENCARGO)
  const [cipEncargo, setCipEncargo] = useState(INITIAL_CIP_ENCARGO)
  const [entradaRs, setEntradaRs] = useState(INITIAL_ENTRADA_RS)
  const [entradaModo, setEntradaModo] = useState<EntradaModoLabel>(INITIAL_ENTRADA_MODO)
  const [mostrarTabelaParcelas, setMostrarTabelaParcelas] = useState(INITIAL_TABELA_VISIVEL)
  const [mostrarTabelaBuyout, setMostrarTabelaBuyout] = useState(INITIAL_TABELA_VISIVEL)
  const [mostrarTabelaParcelasConfig, setMostrarTabelaParcelasConfig] = useState(INITIAL_TABELA_VISIVEL)
  const [mostrarTabelaBuyoutConfig, setMostrarTabelaBuyoutConfig] = useState(INITIAL_TABELA_VISIVEL)
  const [salvandoPropostaPdf, setSalvandoPropostaPdf] = useState(false)

  const [oemBase, setOemBase] = useState(INITIAL_OEM_BASE)
  const [oemInflacao, setOemInflacao] = useState(INITIAL_OEM_INFLACAO)
  const [seguroModo, setSeguroModo] = useState<SeguroModo>(INITIAL_SEGURO_MODO)
  const [seguroReajuste, setSeguroReajuste] = useState(INITIAL_SEGURO_REAJUSTE)
  const [seguroValorA, setSeguroValorA] = useState(INITIAL_SEGURO_VALOR_A)
  const [seguroPercentualB, setSeguroPercentualB] = useState(INITIAL_SEGURO_PERCENTUAL_B)

  const [exibirLeasingLinha, setExibirLeasingLinha] = useState(INITIAL_EXIBIR_LEASING_LINHA)
  const [exibirFinLinha, setExibirFinLinha] = useState(INITIAL_EXIBIR_FIN_LINHA)

  const [cashbackPct, setCashbackPct] = useState(INITIAL_CASHBACK_PCT)
  const [depreciacaoAa, setDepreciacaoAa] = useState(INITIAL_DEPRECIACAO_AA)
  const [inadimplenciaAa, setInadimplenciaAa] = useState(INITIAL_INADIMPLENCIA_AA)
  const [tributosAa, setTributosAa] = useState(INITIAL_TRIBUTOS_AA)
  const [ipcaAa, setIpcaAa] = useState(INITIAL_IPCA_AA)
  const [custosFixosM, setCustosFixosM] = useState(INITIAL_CUSTOS_FIXOS_M)
  const [opexM, setOpexM] = useState(INITIAL_OPEX_M)
  const [seguroM, setSeguroM] = useState(INITIAL_SEGURO_M)
  const [duracaoMeses, setDuracaoMeses] = useState(INITIAL_DURACAO_MESES)
  // Valor informado (ou calculado) de parcelas efetivamente pagas até o mês analisado, usado no crédito de cashback
  const [pagosAcumAteM, setPagosAcumAteM] = useState(INITIAL_PAGOS_ACUM_ATE_M)

  const mesReferencia = mesReferenciaRef.current

  useEffect(() => {
    crmIntegrationModeRef.current = crmIntegrationMode
  }, [crmIntegrationMode])

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
    if (!ufTarifa) {
      setDistribuidoraTarifa('')
      return
    }

    const lista = distribuidorasPorUf?.[ufTarifa]
    if (!lista || lista.length === 0) {
      setDistribuidoraTarifa('')
      return
    }

    setDistribuidoraTarifa((atual) => {
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
    if (capexManualOverride) {
      return
    }
    const total = kitBudget.total
    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
      return
    }
    let changed = false
    setVendaForm((prev) => {
      if (Math.abs((prev.capex_total ?? 0) - total) < 0.5) {
        return prev
      }
      changed = true
      return { ...prev, capex_total: total }
    })
    if (changed) {
      setVendaFormErrors((prev) => {
        if (!prev.capex_total) {
          return prev
        }
        const { capex_total: _removed, ...rest } = prev
        return rest
      })
      resetRetorno()
    }
  }, [capexManualOverride, kitBudget.total, resetRetorno])

  const geracaoMensalKwh = useMemo(() => {
    if (potenciaInstaladaKwp <= 0 || fatorGeracaoMensal <= 0) {
      return 0
    }
    return Math.round(potenciaInstaladaKwp * fatorGeracaoMensal)
  }, [potenciaInstaladaKwp, fatorGeracaoMensal])

  useEffect(() => {
    let updated = false
    setVendaForm((prev) => {
      const next = { ...prev }
      if (
        (prev.potencia_instalada_kwp === undefined || prev.potencia_instalada_kwp <= 0) &&
        potenciaInstaladaKwp > 0
      ) {
        next.potencia_instalada_kwp = potenciaInstaladaKwp
        updated = true
      }
      if (
        (prev.geracao_estimada_kwh_mes === undefined || prev.geracao_estimada_kwh_mes <= 0) &&
        geracaoMensalKwh > 0
      ) {
        next.geracao_estimada_kwh_mes = geracaoMensalKwh
        updated = true
      }
      if (
        (prev.quantidade_modulos === undefined || prev.quantidade_modulos <= 0) &&
        numeroPlacasEstimado > 0
      ) {
        next.quantidade_modulos = numeroPlacasEstimado
        updated = true
      }
      return updated ? next : prev
    })
    if (updated) {
      resetRetorno()
    }
  }, [geracaoMensalKwh, numeroPlacasEstimado, potenciaInstaladaKwp, resetRetorno])

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

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 && diasMesNormalizado > 0 ? geracaoMensalKwh / diasMesNormalizado : 0),
    [geracaoMensalKwh, diasMesNormalizado],
  )

  const encargosFixos = useMemo(
    () => Math.max(0, bandeiraEncargo + cipEncargo + encargosFixosExtras),
    [bandeiraEncargo, cipEncargo, encargosFixosExtras],
  )

  const entradaConsiderada = isVendaDiretaTab ? 0 : entradaRs
  const descontoConsiderado = isVendaDiretaTab ? 0 : desconto
  const prazoMesesConsiderado = isVendaDiretaTab ? 0 : prazoMeses

  const modoEntradaNormalizado = useMemo<EntradaModo>(() => {
    if (!entradaConsiderada || entradaConsiderada <= 0) return 'NONE'
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (label.includes('crédito')) return 'CREDITO'
    if (label.includes('reduz')) return 'REDUZ'
    return 'NONE'
  }, [entradaConsiderada, entradaModo])

  const capex = useMemo(() => potenciaInstaladaKwp * precoPorKwp, [potenciaInstaladaKwp, precoPorKwp])

  const simulationState = useMemo<SimulationState>(() => {
    // Mantemos o valor de mercado (vm0) amarrado ao CAPEX calculado neste mesmo memo para
    // evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, capex)
    const descontoDecimal = Math.max(0, Math.min(descontoConsiderado / 100, 1))
    const inflacaoAnual = Math.max(-0.99, inflacaoAa / 100)
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: Math.max(0, Math.floor(prazoMesesConsiderado)),
      taxaMinima: Math.max(0, taxaMinima),
      encargosFixos,
      entradaRs: Math.max(0, entradaConsiderada),
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
    descontoConsiderado,
    entradaConsiderada,
    geracaoMensalKwh,
    inflacaoAa,
    inadimplenciaAa,
    ipcaAa,
    kcKwhMes,
    mesReajuste,
    modoEntradaNormalizado,
    opexM,
    pagosAcumAteM,
    prazoMesesConsiderado,
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

  const leasingPrazoConsiderado = isVendaDiretaTab ? 0 : leasingPrazo

  const leasingBeneficios = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const tarifaCheiaProj = tarifaAno(ano)
      const tarifaDescontadaProj = tarifaDescontadaAno(ano)
      const custoSemSistema = kcKwhMes * tarifaCheiaProj + encargosFixos + taxaMinima
      const custoComSistema =
        (ano <= leasingPrazoConsiderado ? kcKwhMes * tarifaDescontadaProj : 0) + encargosFixos + taxaMinima
      const beneficio = 12 * (custoSemSistema - custoComSistema)
      return beneficio
    })
  }, [
    anosAnalise,
    encargosFixos,
    kcKwhMes,
    leasingPrazoConsiderado,
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

  const vendaRetornoAuto = useMemo(() => {
    if (!isVendaDiretaTab) {
      return null
    }
    if (retornoProjetado) {
      return retornoProjetado
    }
    const errors = validateVendaForm(vendaForm)
    if (Object.keys(errors).length > 0) {
      return null
    }
    try {
      return computeROI(vendaForm)
    } catch (error) {
      console.warn('Não foi possível calcular o retorno para impressão.', error)
      return null
    }
  }, [isVendaDiretaTab, retornoProjetado, validateVendaForm, vendaForm])

  const printableData = useMemo<PrintableProps>(
    () => {
      const capexPrintable =
        isVendaDiretaTab && Number.isFinite(vendaForm.capex_total) && (vendaForm.capex_total ?? 0) > 0
          ? Number(vendaForm.capex_total)
          : capex
      const potenciaInstaladaPrintable =
        isVendaDiretaTab && Number.isFinite(vendaForm.potencia_instalada_kwp)
          ? Number(vendaForm.potencia_instalada_kwp)
          : potenciaInstaladaKwp
      const geracaoMensalPrintable =
        isVendaDiretaTab && Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
          ? Number(vendaForm.geracao_estimada_kwh_mes)
          : geracaoMensalKwh
      const numeroPlacasPrintable =
        isVendaDiretaTab && Number.isFinite(vendaForm.quantidade_modulos)
          ? Math.max(0, Number(vendaForm.quantidade_modulos))
          : numeroPlacasEstimado
      const vendaResumo = isVendaDiretaTab
        ? {
            form: { ...vendaForm },
            retorno: vendaRetornoAuto,
          }
        : undefined

      return {
        cliente,
        budgetId: currentBudgetId,
        anos: anosArray,
        leasingROI,
        financiamentoFluxo,
        financiamentoROI,
        mostrarFinanciamento,
        tabelaBuyout,
        buyoutResumo,
        capex: capexPrintable,
        tipoProposta: isVendaDiretaTab ? 'VENDA_DIRETA' : 'LEASING',
        geracaoMensalKwh: geracaoMensalPrintable,
        potenciaPlaca,
        numeroPlacas: numeroPlacasPrintable,
        potenciaInstaladaKwp: potenciaInstaladaPrintable,
        tipoInstalacao,
        areaInstalacao,
        descontoContratualPct: descontoConsiderado,
        parcelasLeasing: isVendaDiretaTab ? [] : parcelasSolarInvest.lista,
        distribuidoraTarifa: distribuidoraTarifa || cliente.distribuidora || '',
        energiaContratadaKwh: kcKwhMes,
        tarifaCheia,
        vendaResumo,
      }
    },
    [
      areaInstalacao,
      currentBudgetId,
      anosArray,
      buyoutResumo,
      capex,
      cliente,
      descontoConsiderado,
      financiamentoFluxo,
      financiamentoROI,
      geracaoMensalKwh,
      kcKwhMes,
      leasingROI,
      mostrarFinanciamento,
      numeroPlacasEstimado,
      parcelasSolarInvest,
      distribuidoraTarifa,
      tipoInstalacao,
      potenciaInstaladaKwp,
      potenciaPlaca,
      tabelaBuyout,
      tarifaCheia,
      isVendaDiretaTab,
      vendaForm,
      vendaRetornoAuto,
    ],
  )

  const openBudgetPreviewWindow = useCallback(
    (
      layoutHtml: string,
      {
        nomeCliente,
        budgetId,
        actionMessage,
        autoPrint,
        closeAfterPrint,
        initialMode,
        initialVariant = 'standard',
      }: BudgetPreviewOptions,
    ) => {
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

      const resolvedInitialMode: PrintMode =
        initialMode || (autoPrint ? (closeAfterPrint ? 'download' : 'print') : 'preview')

      const previewHtml = `<!DOCTYPE html>
        <html data-print-mode="${resolvedInitialMode}" data-print-variant="${initialVariant}">
          <head>
            <meta charset="utf-8" />
            <title>Proposta-${nomeCliente}</title>
            <style>
              ${printStyles}
              ${simplePrintStyles}
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
              .preview-container{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;padding:24px 0 40px;}
              @media print{
                body{padding-top:0;}
                .preview-toolbar{display:none;}
              }
            </style>
          </head>
          <body data-print-mode="${resolvedInitialMode}" data-print-variant="${initialVariant}">
            <div class="preview-toolbar">
              <div class="preview-toolbar-info">
                <h1>Pré-visualização da proposta</h1>
                <p>${mensagemToolbar}</p>
                ${codigoHtml}
              </div>
              <div class="preview-toolbar-actions">
                <button type="button" data-action="print">Imprimir</button>
                <button type="button" data-action="download">Baixar PDF</button>
                <button type="button" data-action="toggle-variant" class="secondary" data-label-simple="Versão Simples" data-label-standard="Versão Completa" aria-pressed="${initialVariant === 'simple' ? 'true' : 'false'}">Versão Simples</button>
                <button type="button" data-action="close" class="secondary">Fechar</button>
              </div>
            </div>
            <div class="preview-container">${layoutHtml}</div>
            <script>
              (function(){
                var shouldAutoPrint = ${autoPrint ? 'true' : 'false'};
                var shouldCloseAfterPrint = ${closeAfterPrint ? 'true' : 'false'};
                var defaultMode = "${resolvedInitialMode}";
                var defaultVariant = "${initialVariant}";
                var currentVariant = defaultVariant;
                var setPrintMode = function(mode){
                  if(!mode){ return; }
                  document.body.setAttribute('data-print-mode', mode);
                  document.documentElement.setAttribute('data-print-mode', mode);
                };
                var resetPrintMode = function(){
                  document.body.setAttribute('data-print-mode', 'preview');
                  document.documentElement.setAttribute('data-print-mode', 'preview');
                };
                setPrintMode(defaultMode);
                var printBtn = document.querySelector('[data-action=\"print\"]');
                var downloadBtn = document.querySelector('[data-action=\"download\"]');
                var closeBtn = document.querySelector('[data-action=\"close\"]');
                var variantToggleBtn = document.querySelector('[data-action=\"toggle-variant\"]');
                var setVariant = function(nextVariant){
                  currentVariant = nextVariant === 'simple' ? 'simple' : 'standard';
                  document.body.setAttribute('data-print-variant', currentVariant);
                  document.documentElement.setAttribute('data-print-variant', currentVariant);
                  if(variantToggleBtn){
                    var isSimple = currentVariant === 'simple';
                    var simpleLabel = variantToggleBtn.getAttribute('data-label-simple') || 'Versão Simples';
                    var standardLabel = variantToggleBtn.getAttribute('data-label-standard') || 'Versão Completa';
                    variantToggleBtn.textContent = isSimple ? standardLabel : simpleLabel;
                    variantToggleBtn.setAttribute('aria-pressed', isSimple ? 'true' : 'false');
                    variantToggleBtn.title = isSimple ? 'Retornar ao layout completo' : 'Visual simplificado para impressão em preto e branco';
                  }
                };
                setVariant(defaultVariant);
                if(printBtn){
                  printBtn.addEventListener('click', function(){
                    setPrintMode('print');
                    window.print();
                  });
                }
                if(downloadBtn){
                  downloadBtn.addEventListener('click', function(){
                    setPrintMode('download');
                    window.print();
                  });
                }
                if(closeBtn){
                  closeBtn.addEventListener('click', function(){ window.close(); });
                }
                if(variantToggleBtn){
                  variantToggleBtn.addEventListener('click', function(){
                    setVariant(currentVariant === 'simple' ? 'standard' : 'simple');
                  });
                }
                window.addEventListener('beforeprint', function(){
                  if(document.body.getAttribute('data-print-mode') === 'preview'){
                    setPrintMode('print');
                  }
                });
                window.addEventListener('afterprint', function(){
                  if(shouldCloseAfterPrint){
                    window.setTimeout(function(){ window.close(); }, 180);
                  } else {
                    resetPrintMode();
                  }
                });
                if(shouldAutoPrint){
                  window.addEventListener('load', function(){
                    window.setTimeout(function(){
                      var autoMode = defaultMode && defaultMode !== 'preview' ? defaultMode : (shouldCloseAfterPrint ? 'download' : 'print');
                      setPrintMode(autoMode);
                      window.print();
                    }, 320);
                  });
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

  const prepararPropostaParaExportacao = useCallback(async () => {
    const dadosParaImpressao = clonePrintableData(printableData)
    let layoutHtml: string | null = null

    try {
      layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao)
    } catch (error) {
      console.error('Erro ao preparar a proposta para exportação.', error)
    }

    if (!layoutHtml) {
      const node = printableRef.current
      if (node) {
        const clone = node.cloneNode(true) as HTMLElement
        const codigoDd = clone.querySelector('.print-client-grid .print-client-field:first-child dd')
        if (codigoDd && dadosParaImpressao.budgetId) {
          codigoDd.textContent = dadosParaImpressao.budgetId
        }
        layoutHtml = clone.outerHTML
      }
    }

    if (!layoutHtml) {
      return null
    }

    return { html: layoutHtml, dados: dadosParaImpressao }
  }, [printableData])

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

  const mapClienteRegistroToSyncPayload = (registro: ClienteRegistro): ClienteRegistroSyncPayload => ({
    id: registro.id,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
    dados: { ...registro.dados },
  })

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
      const existingIds = new Set<string>()
      let houveAtualizacaoIds = false

      const normalizados = parsed.map((item) => {
        const registro = item as Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> }
        const dados = registro.dados ?? (registro as unknown as { cliente?: Partial<ClienteDados> }).cliente ?? {}
        const rawId = (registro.id ?? '').toString()
        const sanitizedCandidate = normalizeClienteIdCandidate(rawId)
        const idNormalizado = ensureClienteId(rawId, existingIds)
        if (idNormalizado !== sanitizedCandidate || rawId.trim() !== idNormalizado) {
          houveAtualizacaoIds = true
        }

        const normalizado: ClienteRegistro = {
          id: idNormalizado,
          criadoEm: registro.criadoEm ?? agora,
          atualizadoEm: registro.atualizadoEm ?? registro.criadoEm ?? agora,
          dados: {
            nome: dados?.nome ?? '',
            documento: dados?.documento ?? '',
            email: dados?.email ?? '',
            telefone: dados?.telefone ?? '',
            cep: dados?.cep ?? '',
            distribuidora: dados?.distribuidora ?? '',
            uc: dados?.uc ?? '',
            endereco: dados?.endereco ?? '',
            cidade: dados?.cidade ?? '',
            uf: dados?.uf ?? '',
          },
        }
        return normalizado
      })

      const ordenados = normalizados.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

      if (houveAtualizacaoIds) {
        try {
          window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ordenados))
        } catch (error) {
          console.warn('Não foi possível atualizar os identificadores dos clientes salvos.', error)
        }
      }

      return ordenados
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

  useEffect(() => {
    if (!crmLeadSelecionado) {
      setCrmContratoForm((prev) => ({
        ...prev,
        leadId: '',
        modelo: 'LEASING',
        valorTotal: '',
        entrada: '',
        parcelas: '36',
        valorParcela: '',
        reajusteAnualPct: '3',
      }))
      setCrmCustosForm({ equipamentos: '', maoDeObra: '', deslocamento: '', taxasSeguros: '' })
      setCrmManutencaoForm((prev) => ({ ...prev, leadId: '' }))
      setCrmLancamentoForm((prev) => ({ ...prev, leadId: '' }))
      return
    }

    const contrato = crmDataset.contratos.find((item) => item.leadId === crmLeadSelecionado.id)
    setCrmContratoForm({
      leadId: crmLeadSelecionado.id,
      modelo: contrato?.modelo ?? crmLeadSelecionado.tipoOperacao,
      valorTotal: contrato ? String(contrato.valorTotal) : crmLeadSelecionado.valorEstimado.toString(),
      entrada: contrato ? String(contrato.entrada) : '0',
      parcelas: contrato ? String(contrato.parcelas) : crmLeadSelecionado.tipoOperacao === 'LEASING' ? '60' : '1',
      valorParcela: contrato ? String(contrato.valorParcela) : '0',
      reajusteAnualPct: contrato ? String(contrato.reajusteAnualPct) : '3',
      vencimentoInicialIso: contrato
        ? contrato.vencimentoInicialIso.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      status: contrato?.status ?? 'em-aberto',
    })

    const custos = crmDataset.custos.find((item) => item.leadId === crmLeadSelecionado.id)
    setCrmCustosForm({
      equipamentos: custos ? String(custos.equipamentos) : '',
      maoDeObra: custos ? String(custos.maoDeObra) : '',
      deslocamento: custos ? String(custos.deslocamento) : '',
      taxasSeguros: custos ? String(custos.taxasSeguros) : '',
    })

    setCrmManutencaoForm((prev) => ({
      ...prev,
      leadId: crmLeadSelecionado.id,
      dataIso: prev.dataIso || new Date().toISOString().slice(0, 10),
    }))

    setCrmLancamentoForm((prev) => ({
      ...prev,
      leadId: crmLeadSelecionado.id,
    }))
  }, [crmDataset.contratos, crmDataset.custos, crmLeadSelecionado])

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

  const crmFinanceiroResumo = useMemo(() => {
    const entradas = crmDataset.lancamentos
      .filter((item) => item.tipo === 'entrada')
      .reduce((total, item) => total + item.valor, 0)
    const saidas = crmDataset.lancamentos
      .filter((item) => item.tipo === 'saida')
      .reduce((total, item) => total + item.valor, 0)
    const saldo = entradas - saidas

    const agrupadoPorDia = crmDataset.lancamentos.reduce(
      (acc, item) => {
        const dia = item.dataIso.slice(0, 10)
        if (!acc[dia]) {
          acc[dia] = { entradas: 0, saidas: 0 }
        }
        if (item.tipo === 'entrada') {
          acc[dia].entradas += item.valor
        } else {
          acc[dia].saidas += item.valor
        }
        return acc
      },
      {} as Record<string, { entradas: number; saidas: number }>,
    )

    let saldoAcumulado = 0
    const fluxoOrdenado = Object.entries(agrupadoPorDia)
      .sort(([dataA], [dataB]) => (dataA < dataB ? -1 : 1))
      .map(([data, valores]) => {
        const saldoDia = valores.entradas - valores.saidas
        saldoAcumulado += saldoDia
        return {
          data,
          entradas: valores.entradas,
          saidas: valores.saidas,
          saldoAcumulado,
        }
      })

    const contratosLeasing = crmDataset.contratos.filter((contrato) => contrato.modelo === 'LEASING')
    const contratosVenda = crmDataset.contratos.filter((contrato) => contrato.modelo === 'VENDA_DIRETA')

    const previsaoLeasing = contratosLeasing.reduce(
      (total, contrato) => total + contrato.valorParcela * Math.max(0, contrato.parcelas),
      0,
    )
    const previsaoVendas = contratosVenda.reduce((total, contrato) => total + contrato.valorTotal, 0)
    const inadimplentes = crmDataset.contratos.filter((contrato) => contrato.status === 'inadimplente').length
    const contratosAtivos = crmDataset.contratos.filter((contrato) => contrato.status === 'ativo').length

    const margens = crmDataset.leads.map((lead) => {
      const custos = crmDataset.custos.find((item) => item.leadId === lead.id)
      const custoTotal = custos
        ? custos.equipamentos + custos.maoDeObra + custos.deslocamento + custos.taxasSeguros
        : 0
      const margemBruta = lead.valorEstimado - custoTotal
      const margemPct = custoTotal > 0 ? (margemBruta / custoTotal) * 100 : null
      const roi = custoTotal > 0 ? (lead.valorEstimado - custoTotal) / custoTotal : null
      return {
        leadId: lead.id,
        leadNome: lead.nome,
        margemBruta,
        margemPct,
        custoTotal,
        receitaProjetada: lead.valorEstimado,
        roi,
        modelo: lead.tipoOperacao,
      }
    })

    margens.sort((a, b) => b.margemBruta - a.margemBruta)

    return {
      entradas,
      saidas,
      saldo,
      fluxoOrdenado,
      previsaoLeasing,
      previsaoVendas,
      inadimplentes,
      contratosAtivos,
      margens: margens.slice(0, 8),
    }
  }, [crmDataset.contratos, crmDataset.custos, crmDataset.lancamentos, crmDataset.leads])

  const crmPosVendaResumo = useMemo(() => {
    // Quantifica todas as manutenções cadastradas para criar os alertas de pós-venda.
    const totalManutencoes = crmDataset.manutencoes.length
    const pendentes = crmDataset.manutencoes.filter((item) => item.status === 'pendente')
    const concluidas = crmDataset.manutencoes.filter((item) => item.status === 'concluida')

    // Ordenamos as próximas visitas técnicas para que o gestor visualize rapidamente o que está por vir.
    const proximas = [...pendentes]
      .sort((a, b) => (a.dataIso < b.dataIso ? -1 : 1))
      .slice(0, 6)

    // Simulamos os dados de geração utilizando o consumo informado pelo lead.
    const geracao = crmDataset.leads
      .filter((lead) => lead.etapa === 'fechado')
      .slice(0, 8)
      .map((lead) => {
        const geracaoPrevista = Math.max(0, lead.consumoKwhMes)
        const fatorStatus =
          lead.instalacaoStatus === 'concluida' ? 1.05 : lead.instalacaoStatus === 'em-andamento' ? 0.65 : 0.4
        const geracaoAtual = Math.round(geracaoPrevista * fatorStatus)
        const alertaBaixa = geracaoPrevista > 0 && geracaoAtual < geracaoPrevista * 0.8
        return {
          id: lead.id,
          nome: lead.nome,
          geracaoPrevista,
          geracaoAtual,
          alertaBaixa,
          cidade: lead.cidade,
        }
      })

    const alertasCriticos = proximas
      .filter((item) => diasDesdeDataIso(item.dataIso) <= 2)
      .map((item) =>
        `Manutenção ${item.tipo} para ${formatarDataCurta(item.dataIso)} está há poucos dias do vencimento.`,
      )

    const chamadosRecentes = crmDataset.timeline
      .filter((item) => item.tipo === 'anotacao')
      .slice(0, 8)
      .map((item) => ({
        ...item,
        dataFormatada: formatarDataCurta(item.criadoEmIso),
      }))

    return {
      totalManutencoes,
      pendentes: pendentes.length,
      concluidas: concluidas.length,
      proximas,
      geracao,
      alertasCriticos,
      chamadosRecentes,
    }
  }, [crmDataset.manutencoes, crmDataset.leads, crmDataset.timeline])

  const crmIndicadoresGerenciais = useMemo(() => {
    // Calculamos a taxa de conversão geral a partir dos leads existentes.
    const totalLeads = crmDataset.leads.length
    const leadsFechados = crmDataset.leads.filter((lead) => lead.etapa === 'fechado')
    const taxaConversao = totalLeads > 0 ? Math.round((leadsFechados.length / totalLeads) * 100) : 0

    // O tempo médio de fechamento considera o intervalo entre criação e último contato dos projetos fechados.
    const tempoMedioFechamento = leadsFechados.length
      ? Math.round(
          leadsFechados.reduce((total, lead) => {
            const criado = new Date(lead.criadoEmIso).getTime()
            const atualizado = new Date(lead.ultimoContatoIso).getTime()
            const diffDias = Math.max(0, Math.round((atualizado - criado) / (1000 * 60 * 60 * 24)))
            return total + diffDias
          }, 0) / leadsFechados.length,
        )
      : 0

    // Agrupamos os leads por origem para alimentar o dashboard de marketing.
    const leadsPorOrigem = crmDataset.leads.reduce<Record<string, number>>((acc, lead) => {
      const origem = lead.origemLead || 'Indefinido'
      acc[origem] = (acc[origem] ?? 0) + 1
      return acc
    }, {})

    // Identificamos gargalos quando há acúmulo acima de 5 leads em uma etapa intermediária.
    const gargalos = CRM_PIPELINE_STAGES.filter((stage) => stage.id !== 'fechado' && stage.id !== 'novo-lead')
      .map((stage) => {
        const quantidade = crmDataset.leads.filter((lead) => lead.etapa === stage.id).length
        return quantidade >= 5 ? `${stage.label} possui ${quantidade} leads aguardando ação.` : null
      })
      .filter((item): item is string => Boolean(item))

    // ROI médio utilizando os dados de margem calculados na etapa financeira.
    const roiMedio = crmFinanceiroResumo.margens.length
      ? Math.round(
          (crmFinanceiroResumo.margens.reduce((total, item) => total + (item.roi ?? 0), 0) /
            crmFinanceiroResumo.margens.length) *
            100,
        ) / 100
      : 0

    const mapaGeracao = crmDataset.leads.reduce<Record<string, number>>((acc, lead) => {
      if (!lead.cidade) {
        return acc
      }
      acc[lead.cidade] = (acc[lead.cidade] ?? 0) + lead.consumoKwhMes
      return acc
    }, {})

    return {
      taxaConversao,
      tempoMedioFechamento,
      leadsPorOrigem,
      gargalos,
      roiMedio,
      receitaRecorrenteProjetada: crmFinanceiroResumo.previsaoLeasing,
      receitaPontualProjetada: crmFinanceiroResumo.previsaoVendas,
      mapaGeracao,
    }
  }, [crmDataset.leads, crmFinanceiroResumo])

  const crmManutencoesPendentes = useMemo(
    () =>
      crmDataset.manutencoes
        .filter((item) => item.status === 'pendente')
        .sort((a, b) => (a.dataIso < b.dataIso ? -1 : 1))
        .slice(0, 12),
    [crmDataset.manutencoes],
  )

  const crmContratosPorLead = useMemo(() => {
    const mapa = new Map<string, CrmContratoFinanceiro>()
    crmDataset.contratos.forEach((contrato) => {
      if (!mapa.has(contrato.leadId)) {
        mapa.set(contrato.leadId, contrato)
      }
    })
    return mapa
  }, [crmDataset.contratos])

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

      setCrmDataset((prev) => {
        const jaPossuiContrato = prev.contratos.some((item) => item.leadId === novoLead.id)
        const parcelasPadrao = novoLead.tipoOperacao === 'LEASING' ? 60 : 1
        const entradaPadrao = novoLead.tipoOperacao === 'VENDA_DIRETA' ? Math.round(novoLead.valorEstimado * 0.2) : 0
        const valorParcelaPadrao = parcelasPadrao
          ? Math.max(0, Math.round(((novoLead.valorEstimado - entradaPadrao) / parcelasPadrao) * 100) / 100)
          : 0

        const contratoDefault: CrmContratoFinanceiro = {
          id: gerarIdCrm('contrato'),
          leadId: novoLead.id,
          modelo: novoLead.tipoOperacao,
          valorTotal: novoLead.valorEstimado,
          entrada: entradaPadrao,
          parcelas: parcelasPadrao,
          valorParcela: valorParcelaPadrao,
          reajusteAnualPct: 3,
          vencimentoInicialIso: agoraIso,
          status: 'em-aberto',
        }

        const custosDefault: CrmCustoProjeto = {
          id: gerarIdCrm('custo'),
          leadId: novoLead.id,
          equipamentos: 0,
          maoDeObra: 0,
          deslocamento: 0,
          taxasSeguros: 0,
        }

        const manutencaoFutura = new Date()
        manutencaoFutura.setMonth(manutencaoFutura.getMonth() + 6)
        const manutencaoDefault: CrmManutencaoRegistro = {
          id: gerarIdCrm('manutencao'),
          leadId: novoLead.id,
          dataIso: manutencaoFutura.toISOString(),
          tipo: 'Manutenção preventiva programada',
          status: 'pendente',
          observacao: 'Agendamento automático ao captar o lead.',
        }

        return {
          ...prev,
          leads: [novoLead, ...prev.leads],
          timeline: [evento, ...prev.timeline].slice(0, 120),
          contratos: jaPossuiContrato ? prev.contratos : [contratoDefault, ...prev.contratos],
          custos: prev.custos.some((item) => item.leadId === novoLead.id)
            ? prev.custos
            : [custosDefault, ...prev.custos],
          manutencoes: prev.manutencoes.some((item) => item.leadId === novoLead.id)
            ? prev.manutencoes
            : [manutencaoDefault, ...prev.manutencoes],
        }
      })

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

        const leadsAtualizados = prev.leads.map((lead) => {
          if (lead.id !== leadId) {
            return lead
          }

          let novoStatusInstalacao = lead.instalacaoStatus
          if (novaEtapa === 'aguardando-contrato' || novaEtapa === 'proposta-enviada') {
            novoStatusInstalacao = 'planejamento'
          } else if (novaEtapa === 'fechado') {
            novoStatusInstalacao = lead.instalacaoStatus === 'concluida' ? 'concluida' : 'em-andamento'
          } else if (novaEtapa === 'negociacao' && lead.instalacaoStatus === 'em-andamento') {
            novoStatusInstalacao = 'aguardando-homologacao'
          }

          return {
            ...lead,
            etapa: novaEtapa,
            ultimoContatoIso: agoraIso,
            instalacaoStatus: novoStatusInstalacao,
          }
        })

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId,
          mensagem: `Etapa atualizada de ${CRM_PIPELINE_STAGES[indiceAtual].label} para ${CRM_PIPELINE_STAGES[novoIndice].label}.`,
          tipo: 'status',
          criadoEmIso: agoraIso,
        }

        return {
          ...prev,
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
      ...prev,
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

  const handleAtualizarStatusInstalacao = useCallback(
    (leadId: string, status: CrmLeadRecord['instalacaoStatus']) => {
      setCrmDataset((prev) => ({
        ...prev,
        leads: prev.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                instalacaoStatus: status,
                ultimoContatoIso: new Date().toISOString(),
              }
            : lead,
        ),
      }))
      adicionarNotificacao('Status da instalação atualizado.', 'success')
    },
    [adicionarNotificacao],
  )

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
          ...prev,
          leads: leadsRestantes,
          timeline: [evento, ...prev.timeline].slice(0, 120),
          contratos: prev.contratos.filter((contrato) => contrato.leadId !== leadId),
          custos: prev.custos.filter((custo) => custo.leadId !== leadId),
          manutencoes: prev.manutencoes.filter((manutencao) => manutencao.leadId !== leadId),
          lancamentos: prev.lancamentos.filter((lancamento) => lancamento.leadId !== leadId),
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

  const handleRegistrarLancamentoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const valorNumerico = Number(String(crmLancamentoForm.valor).replace(',', '.'))
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        adicionarNotificacao('Informe um valor numérico positivo para o lançamento financeiro.', 'error')
        return
      }

      const dataIso = crmLancamentoForm.dataIso
        ? new Date(`${crmLancamentoForm.dataIso}T00:00:00`).toISOString()
        : new Date().toISOString()

      const leadIdReferencia = crmLancamentoForm.leadId || crmLeadSelecionado?.id
      const leadValido = leadIdReferencia
        ? crmDataset.leads.some((lead) => lead.id === leadIdReferencia)
        : false

      const novoLancamento: CrmLancamentoCaixa = {
        id: gerarIdCrm('lancamento'),
        leadId: leadValido ? leadIdReferencia : undefined,
        dataIso,
        categoria: crmLancamentoForm.categoria,
        origem: crmLancamentoForm.origem.trim() || 'Operação',
        formaPagamento: crmLancamentoForm.formaPagamento,
        tipo: crmLancamentoForm.tipo,
        valor: Math.round(valorNumerico * 100) / 100,
        observacao: crmLancamentoForm.observacao.trim() || undefined,
      }

      const evento: CrmTimelineEntry | null = novoLancamento.leadId
        ? {
            id: gerarIdCrm('evento'),
            leadId: novoLancamento.leadId,
            mensagem: `Lançamento financeiro (${novoLancamento.tipo === 'entrada' ? 'entrada' : 'saída'}) de ${currency(
              novoLancamento.valor,
            )} registrado em ${formatarDataCurta(dataIso)}.`,
            tipo: 'status',
            criadoEmIso: new Date().toISOString(),
          }
        : null

      setCrmDataset((prev) => ({
        ...prev,
        lancamentos: [novoLancamento, ...prev.lancamentos].slice(0, 200),
        timeline: evento ? [evento, ...prev.timeline].slice(0, 120) : prev.timeline,
      }))

      setCrmLancamentoForm((prev) => ({
        ...prev,
        valor: '',
        observacao: '',
      }))

      adicionarNotificacao('Lançamento financeiro salvo com sucesso.', 'success')
    },
    [adicionarNotificacao, crmDataset.leads, crmLancamentoForm, crmLeadSelecionado],
  )

  const handleSalvarCustosCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!crmLeadSelecionado) {
        adicionarNotificacao('Selecione um lead para detalhar os custos do projeto.', 'error')
        return
      }

      const parse = (valor: string) => {
        const numero = Number(valor.replace(',', '.'))
        return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : 0
      }

      const custosAtualizados: CrmCustoProjeto = {
        id: gerarIdCrm('custo'),
        leadId: crmLeadSelecionado.id,
        equipamentos: parse(crmCustosForm.equipamentos),
        maoDeObra: parse(crmCustosForm.maoDeObra),
        deslocamento: parse(crmCustosForm.deslocamento),
        taxasSeguros: parse(crmCustosForm.taxasSeguros),
      }

      setCrmDataset((prev) => {
        const jaExistente = prev.custos.some((item) => item.leadId === crmLeadSelecionado.id)
        const listaAtualizada = jaExistente
          ? prev.custos.map((item) => (item.leadId === crmLeadSelecionado.id ? { ...custosAtualizados, id: item.id } : item))
          : [custosAtualizados, ...prev.custos]

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId: crmLeadSelecionado.id,
          mensagem: 'Custos do projeto atualizados para cálculo de margem e ROI.',
          tipo: 'status',
          criadoEmIso: new Date().toISOString(),
        }

        return {
          ...prev,
          custos: listaAtualizada,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      adicionarNotificacao('Custos do projeto registrados.', 'success')
    },
    [adicionarNotificacao, crmCustosForm, crmLeadSelecionado],
  )

  const handleSalvarContratoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const leadAlvoId = crmContratoForm.leadId || crmLeadSelecionado?.id
      if (!leadAlvoId) {
        adicionarNotificacao('Associe o contrato a um lead para controle financeiro.', 'error')
        return
      }

      const leadExiste = crmDataset.leads.some((lead) => lead.id === leadAlvoId)
      if (!leadExiste) {
        adicionarNotificacao('Lead selecionado não encontrado. Recarregue a página ou selecione outro registro.', 'error')
        return
      }

      const parse = (valor: string, fallback = 0) => {
        const numero = Number(valor.replace(',', '.'))
        if (!Number.isFinite(numero) || numero < 0) {
          return fallback
        }
        return Math.round(numero * 100) / 100
      }

      const contratoNormalizado: CrmContratoFinanceiro = {
        id: gerarIdCrm('contrato'),
        leadId: leadAlvoId,
        modelo: crmContratoForm.modelo,
        valorTotal: parse(crmContratoForm.valorTotal, 0),
        entrada: parse(crmContratoForm.entrada, 0),
        parcelas: Math.max(0, Math.round(parse(crmContratoForm.parcelas, 0))),
        valorParcela: parse(crmContratoForm.valorParcela, 0),
        reajusteAnualPct: parse(crmContratoForm.reajusteAnualPct, 0),
        vencimentoInicialIso: crmContratoForm.vencimentoInicialIso
          ? new Date(`${crmContratoForm.vencimentoInicialIso}T00:00:00`).toISOString()
          : new Date().toISOString(),
        status: crmContratoForm.status,
      }

      setCrmDataset((prev) => {
        const contratosAtualizados = prev.contratos.some((item) => item.leadId === leadAlvoId)
          ? prev.contratos.map((item) => (item.leadId === leadAlvoId ? { ...contratoNormalizado, id: item.id } : item))
          : [contratoNormalizado, ...prev.contratos]

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId: leadAlvoId,
          mensagem: `Contrato ${
            contratoNormalizado.modelo === 'LEASING' ? 'de leasing' : 'de venda direta'
          } atualizado (${contratoNormalizado.parcelas} parcelas).`,
          tipo: 'status',
          criadoEmIso: new Date().toISOString(),
        }

        return {
          ...prev,
          contratos: contratosAtualizados,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      adicionarNotificacao('Contrato financeiro sincronizado com o CRM.', 'success')
    },
    [adicionarNotificacao, crmContratoForm, crmDataset.leads, crmLeadSelecionado],
  )

  const handleAdicionarManutencaoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const leadAlvoId = crmManutencaoForm.leadId || crmLeadSelecionado?.id
      if (!leadAlvoId) {
        adicionarNotificacao('Selecione um lead para agendar a manutenção.', 'error')
        return
      }

      const leadExiste = crmDataset.leads.some((lead) => lead.id === leadAlvoId)
      if (!leadExiste) {
        adicionarNotificacao('Não foi possível localizar o lead selecionado.', 'error')
        return
      }

      const dataIso = crmManutencaoForm.dataIso
        ? new Date(`${crmManutencaoForm.dataIso}T00:00:00`).toISOString()
        : new Date().toISOString()

      const manutencao: CrmManutencaoRegistro = {
        id: gerarIdCrm('manutencao'),
        leadId: leadAlvoId,
        dataIso,
        tipo: crmManutencaoForm.tipo.trim() || 'Revisão preventiva',
        status: 'pendente',
        observacao: crmManutencaoForm.observacao.trim() || undefined,
      }

      setCrmDataset((prev) => ({
        ...prev,
        manutencoes: [manutencao, ...prev.manutencoes].slice(0, 200),
        timeline: [
          {
            id: gerarIdCrm('evento'),
            leadId: leadAlvoId,
            mensagem: `Manutenção agendada para ${formatarDataCurta(dataIso)} (${manutencao.tipo}).`,
            tipo: 'status',
            criadoEmIso: new Date().toISOString(),
          },
          ...prev.timeline,
        ].slice(0, 120),
      }))

      setCrmManutencaoForm((prev) => ({
        ...prev,
        observacao: '',
      }))

      adicionarNotificacao('Manutenção registrada e vinculada ao cliente.', 'success')
    },
    [adicionarNotificacao, crmDataset.leads, crmLeadSelecionado, crmManutencaoForm],
  )

  const handleConcluirManutencaoCrm = useCallback(
    (manutencaoId: string) => {
      setCrmDataset((prev) => ({
        ...prev,
        manutencoes: prev.manutencoes.map((item) =>
          item.id === manutencaoId
            ? {
                ...item,
                status: 'concluida',
              }
            : item,
        ),
      }))
      adicionarNotificacao('Manutenção marcada como concluída.', 'success')
    },
    [adicionarNotificacao],
  )

  const handleSyncCrmManualmente = useCallback(() => {
    void persistCrmDataset(crmDataset, 'manual')
    adicionarNotificacao('Sincronização manual solicitada.', 'info')
  }, [adicionarNotificacao, crmDataset, persistCrmDataset])

  const renderCrmPage = () => (
    <div className="page crm-page">
      <header className="topbar crm-header">
        <div className="brand">
          <img src="/logo.svg" alt="SolarInvest" />
          <div className="brand-text">
            <h1>SolarInvest App</h1>
            <p>CRM Gestão de Relacionamento e Operações</p>
          </div>
        </div>
        <div className="crm-header-actions">
          <div className="crm-sync-controls">
            <label htmlFor="crm-sync-mode">Modo de sincronização</label>
            <select
              id="crm-sync-mode"
              value={crmIntegrationMode}
              onChange={(event) => setCrmIntegrationMode(event.target.value as CrmIntegrationMode)}
            >
              <option value="local">Somente local</option>
              <option value="remote">Sincronizar com backend</option>
            </select>
            <button type="button" className="ghost" onClick={handleSyncCrmManualmente}>
              Sincronizar agora
            </button>
            <small className={`crm-sync-status ${crmBackendStatus}`}>
              {crmIntegrationMode === 'remote'
                ? crmBackendStatus === 'success'
                  ? `Sincronizado${crmLastSync ? ` em ${crmLastSync.toLocaleString('pt-BR')}` : ''}`
                  : crmBackendStatus === 'error'
                    ? crmBackendError ?? 'Erro de sincronização'
                    : crmIsSaving
                      ? 'Enviando dados para o backend...'
                      : 'Aguardando alterações para sincronizar'
                : 'Operando somente com dados locais'}
            </small>
          </div>
          <button className="ghost" onClick={() => setActivePage('app')}>
            Voltar para proposta financeira
          </button>
        </div>
      </header>
      <main className="crm-main">
        {/* Seção 1 - Captação e qualificação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>1. Captação e qualificação</h2>
              <p>
                Cadastre leads vindos do site, redes sociais e indicações. Os dados coletados alimentam automaticamente
                os cálculos financeiros da proposta.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Total de leads</span>
                <strong>{crmKpis.totalLeads}</strong>
              </div>
              <div>
                <span>Fechados</span>
                <strong>{crmKpis.leadsFechados}</strong>
              </div>
              <div>
                <span>Receita recorrente</span>
                <strong>{currency(crmKpis.receitaRecorrente)}</strong>
              </div>
              <div>
                <span>Receita pontual</span>
                <strong>{currency(crmKpis.receitaPontual)}</strong>
              </div>
              <div className="warning">
                <span>Leads em risco</span>
                <strong>{crmKpis.leadsEmRisco}</strong>
              </div>
            </div>
          </div>
          <div className="crm-capture-grid">
            <div className="crm-capture-filters">
              <label htmlFor="crm-busca">Buscar lead</label>
              <input
                id="crm-busca"
                type="search"
                value={crmBusca}
                onChange={(event) => setCrmBusca(event.target.value)}
                placeholder="Pesquisar por nome, telefone, origem ou cidade"
              />
              <label htmlFor="crm-operacao-filter">Tipo de operação</label>
              <select
                id="crm-operacao-filter"
                value={crmFiltroOperacao}
                onChange={(event) => setCrmFiltroOperacao(event.target.value as CrmFiltroOperacao)}
              >
                <option value="all">Todos</option>
                <option value="LEASING">Leasing</option>
                <option value="VENDA_DIRETA">Venda</option>
              </select>
              <p className="crm-hint">
                Leads que abrem uma proposta ou respondem mensagem mudam automaticamente de status. O filtro acima ajuda
                a focar nos modelos de operação desejados.
              </p>
            </div>
            <form className="crm-capture-form" onSubmit={handleCrmLeadFormSubmit}>
              <fieldset>
                <legend>Novo lead</legend>
                <div className="crm-form-row">
                  <label>
                    Nome
                    <input
                      value={crmLeadForm.nome}
                      onChange={(event) => handleCrmLeadFormChange('nome', event.target.value)}
                      placeholder="Nome do contato"
                      required
                    />
                  </label>
                  <label>
                    Telefone / WhatsApp
                    <input
                      value={crmLeadForm.telefone}
                      onChange={(event) => handleCrmLeadFormChange('telefone', event.target.value)}
                      placeholder="(62) 99999-0000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Cidade
                    <input
                      value={crmLeadForm.cidade}
                      onChange={(event) => handleCrmLeadFormChange('cidade', event.target.value)}
                      placeholder="Cidade do projeto"
                      required
                    />
                  </label>
                  <label>
                    Origem do lead
                    <input
                      value={crmLeadForm.origemLead}
                      onChange={(event) => handleCrmLeadFormChange('origemLead', event.target.value)}
                      placeholder="Instagram, WhatsApp, Feira..."
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Consumo mensal (kWh)
                    <input
                      value={crmLeadForm.consumoKwhMes}
                      onChange={(event) => handleCrmLeadFormChange('consumoKwhMes', event.target.value)}
                      placeholder="Ex: 1200"
                      required
                    />
                  </label>
                  <label>
                    Valor estimado (R$)
                    <input
                      value={crmLeadForm.valorEstimado}
                      onChange={(event) => handleCrmLeadFormChange('valorEstimado', event.target.value)}
                      placeholder="Ex: 250000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Tipo de imóvel
                    <input
                      value={crmLeadForm.tipoImovel}
                      onChange={(event) => handleCrmLeadFormChange('tipoImovel', event.target.value)}
                      placeholder="Residencial, Comercial, Condomínio..."
                    />
                  </label>
                  <label>
                    Modelo de operação
                    <select
                      value={crmLeadForm.tipoOperacao}
                      onChange={(event) =>
                        handleCrmLeadFormChange('tipoOperacao', event.target.value as CrmLeadFormState['tipoOperacao'])
                      }
                    >
                      <option value="LEASING">Leasing (receita recorrente)</option>
                      <option value="VENDA_DIRETA">Venda (receita pontual)</option>
                    </select>
                  </label>
                </div>
                <label className="crm-form-notes">
                  Observações
                  <textarea
                    rows={2}
                    value={crmLeadForm.notas}
                    onChange={(event) => handleCrmLeadFormChange('notas', event.target.value)}
                    placeholder="Preferências do cliente, dores principais ou combinações iniciais"
                  />
                </label>
              </fieldset>
              <div className="crm-form-actions">
                <button type="submit" className="primary">
                  Adicionar lead ao funil
                </button>
                <p>
                  Ao salvar, o lead recebe uma tag com o tipo de sistema (on-grid, off-grid, condomínio) e gera um
                  registro de projeto vinculado automaticamente.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Seção 2 - Prospecção e proposta */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>2. Prospecção e proposta</h2>
              <p>
                Acompanhe o funil visual de vendas com etapas automáticas. Movimentações geram registros na linha do
                tempo do lead e notificações internas de follow-up.
              </p>
            </div>
          </div>
          <div className="crm-kanban">
            {CRM_PIPELINE_STAGES.map((stage) => {
              const leadsDaEtapa = crmLeadsPorEtapa[stage.id] ?? []
              return (
                <div key={stage.id} className="crm-kanban-column">
                  <header>
                    <h3>{stage.label}</h3>
                    <span>{leadsDaEtapa.length} lead(s)</span>
                  </header>
                  <ul>
                    {leadsDaEtapa.length === 0 ? (
                      <li className="crm-empty">Sem leads aqui no momento</li>
                    ) : (
                      leadsDaEtapa.map((lead) => (
                        <li
                          key={lead.id}
                          className={`crm-lead-chip${crmLeadSelecionadoId === lead.id ? ' selected' : ''}`}
                        >
                          <button type="button" onClick={() => handleSelecionarLead(lead.id)}>
                            <strong>{lead.nome}</strong>
                            <small>{lead.cidade}</small>
                            <small>{currency(lead.valorEstimado)}</small>
                          </button>
                          <div className="crm-lead-actions">
                            <button
                              type="button"
                              aria-label="Mover para etapa anterior"
                              onClick={() => handleMoverLead(lead.id, -1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[0].id}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              aria-label="Mover para próxima etapa"
                              onClick={() => handleMoverLead(lead.id, 1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[CRM_PIPELINE_STAGES.length - 1].id}
                            >
                              ▶
                            </button>
                            <button type="button" className="danger" onClick={() => handleRemoverLead(lead.id)}>
                              Remover
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Seção 3 - Contrato e implantação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>3. Contrato e implantação</h2>
              <p>
                Integração com assinatura digital, checklist técnico e histórico completo de interações e anexos do
                cliente.
              </p>
            </div>
          </div>
          {crmLeadSelecionado ? (
            <div className="crm-selected">
              <div className="crm-selected-summary">
                <h3>{crmLeadSelecionado.nome}</h3>
                <p>
                  {crmLeadSelecionado.telefone} • {crmLeadSelecionado.email || 'E-mail não informado'}
                </p>
                <p>
                  {crmLeadSelecionado.cidade} • Consumo {crmLeadSelecionado.consumoKwhMes} kWh/mês
                </p>
                <label>
                  Status da instalação
                  <select
                    value={crmLeadSelecionado.instalacaoStatus}
                    onChange={(event) =>
                      handleAtualizarStatusInstalacao(
                        crmLeadSelecionado.id,
                        event.target.value as CrmLeadRecord['instalacaoStatus'],
                      )
                    }
                  >
                    {CRM_INSTALACAO_STATUS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Registrar nota
                  <textarea
                    rows={2}
                    value={crmNotaTexto}
                    onChange={(event) => setCrmNotaTexto(event.target.value)}
                    placeholder="Ex: Visita técnica agendada, cliente solicitou revisão de valores"
                  />
                </label>
                <button type="button" className="ghost" onClick={handleAdicionarNotaCrm}>
                  Salvar no histórico
                </button>
              </div>
              <div className="crm-selected-details">
                <div>
                  <h4>Contrato financeiro</h4>
                  {(() => {
                    const contrato = crmContratosPorLead.get(crmLeadSelecionado.id)
                    if (!contrato) {
                      return <p className="crm-empty">Preencha os dados financeiros na seção 6.</p>
                    }
                    return (
                      <ul className="crm-data-list">
                        <li>
                          <span>Modelo</span>
                          <strong>{contrato.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</strong>
                        </li>
                        <li>
                          <span>Parcelas</span>
                          <strong>{contrato.parcelas}x de {currency(contrato.valorParcela)}</strong>
                        </li>
                        <li>
                          <span>Status</span>
                          <strong>{contrato.status.replace('-', ' ')}</strong>
                        </li>
                        <li>
                          <span>Vencimento inicial</span>
                          <strong>{formatarDataCurta(contrato.vencimentoInicialIso)}</strong>
                        </li>
                      </ul>
                    )
                  })()}
                </div>
                <div>
                  <h4>Checklist técnico</h4>
                  <ul className="crm-checklist">
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' ? 'done' : ''}>Captação concluída</li>
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' && crmLeadSelecionado.etapa !== 'qualificacao' ? 'done' : ''}>
                      Proposta enviada
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'negociacao' || crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Negociação em andamento
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Contrato preparado para assinatura
                    </li>
                    <li className={crmLeadSelecionado.instalacaoStatus === 'concluida' ? 'done' : ''}>Usina instalada</li>
                  </ul>
                </div>
                <div>
                  <h4>Histórico recente</h4>
                  <ul className="crm-timeline">
                    {crmTimelineFiltrada.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <span>{formatarDataCurta(item.criadoEmIso)}</span>
                        <p>{item.mensagem}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="crm-empty">Selecione um lead no funil acima para visualizar detalhes de contrato e implantação.</p>
          )}
        </section>

        {/* Seção 4 - Instalação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>4. Instalação</h2>
              <p>
                O módulo técnico assume tarefas, materiais e cronogramas vinculados ao mesmo registro do cliente.
                Atualize a agenda de manutenção preventiva e acompanhe o status de execução em tempo real.
              </p>
            </div>
          </div>
          <div className="crm-install-grid">
            <div>
              <h4>Manutenções pendentes</h4>
              {crmManutencoesPendentes.length === 0 ? (
                <p className="crm-empty">Nenhuma manutenção pendente. Cadastre uma nova abaixo.</p>
              ) : (
                <ul className="crm-maintenance-list">
                  {crmManutencoesPendentes.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{formatarDataCurta(item.dataIso)}</strong>
                        <span>{item.tipo}</span>
                        {item.observacao ? <small>{item.observacao}</small> : null}
                      </div>
                      <button type="button" onClick={() => handleConcluirManutencaoCrm(item.id)}>
                        Concluir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form className="crm-maintenance-form" onSubmit={handleAdicionarManutencaoCrm}>
              <fieldset>
                <legend>Agendar manutenção</legend>
                <label>
                  Cliente (opcional)
                  <select
                    value={crmManutencaoForm.leadId}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                  >
                    <option value="">Usar lead selecionado</option>
                    {crmDataset.leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Data prevista
                  <input
                    type="date"
                    value={crmManutencaoForm.dataIso}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, dataIso: event.target.value }))}
                  />
                </label>
                <label>
                  Tipo de serviço
                  <input
                    value={crmManutencaoForm.tipo}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    placeholder="Vistoria, limpeza, troca de inversor..."
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    rows={2}
                    value={crmManutencaoForm.observacao}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </fieldset>
              <button type="submit" className="ghost">
                Agendar manutenção
              </button>
            </form>
            {crmLeadSelecionado ? (
              <div>
                <h4>Histórico do cliente selecionado</h4>
                <ul className="crm-maintenance-list">
                  {crmDataset.manutencoes
                    .filter((item) => item.leadId === crmLeadSelecionado.id)
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          <small>Status: {item.status}</small>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Seção 5 - Pós-venda e manutenção */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>5. Pós-venda e manutenção</h2>
              <p>
                Monitoramento contínuo da usina, integrações com o inversor e registro de chamados técnicos para manter o
                cliente engajado.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Manutenções totais</span>
                <strong>{crmPosVendaResumo.totalManutencoes}</strong>
              </div>
              <div>
                <span>Pendentes</span>
                <strong>{crmPosVendaResumo.pendentes}</strong>
              </div>
              <div>
                <span>Concluídas</span>
                <strong>{crmPosVendaResumo.concluidas}</strong>
              </div>
              <div>
                <span>Alertas críticos</span>
                <strong>{crmPosVendaResumo.alertasCriticos.length}</strong>
              </div>
            </div>
          </div>
          <div className="crm-post-grid">
            <div className="crm-post-column">
              <h3>Próximas visitas preventivas</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.proximas.length === 0 ? (
                  <li className="crm-empty">Nenhuma visita agendada para os próximos dias.</li>
                ) : (
                  crmPosVendaResumo.proximas.map((item) => {
                    const lead = crmDataset.leads.find((leadItem) => leadItem.id === item.leadId)
                    return (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          {lead ? <small>{lead.nome}</small> : null}
                        </div>
                        <button type="button" className="link" onClick={() => setCrmLeadSelecionadoId(item.leadId)}>
                          Ver lead
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              {crmPosVendaResumo.alertasCriticos.length > 0 ? (
                <div className="crm-alert-banner">
                  <h4>Alertas automáticos</h4>
                  <ul>
                    {crmPosVendaResumo.alertasCriticos.map((texto, index) => (
                      <li key={texto + index}>{texto}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="crm-post-column">
              <h3>Relatório de geração (via API do inversor)</h3>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cidade</th>
                    <th>Previsto (kWh)</th>
                    <th>Gerado (kWh)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {crmPosVendaResumo.geracao.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-empty">
                        Aguarde a integração com o inversor para sincronizar dados de geração.
                      </td>
                    </tr>
                  ) : (
                    crmPosVendaResumo.geracao.map((registro) => (
                      <tr key={registro.id} className={registro.alertaBaixa ? 'alert' : ''}>
                        <td>{registro.nome}</td>
                        <td>{registro.cidade}</td>
                        <td>{registro.geracaoPrevista}</td>
                        <td>{registro.geracaoAtual}</td>
                        <td>{registro.alertaBaixa ? 'Baixa geração' : 'Normal'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="crm-post-column">
              <h3>Chamados recentes</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.chamadosRecentes.length === 0 ? (
                  <li className="crm-empty">Nenhum chamado registrado. Use as notas do lead para registrar atendimentos.</li>
                ) : (
                  crmPosVendaResumo.chamadosRecentes.map((registro) => (
                    <li key={registro.id}>
                      <div>
                        <strong>{registro.dataFormatada}</strong>
                        <span>{registro.mensagem}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Seção 6 - Financeiro integrado */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>6. Financeiro integrado</h2>
              <p>
                Controle de contratos de leasing e vendas diretas, lançamentos de caixa e análise de margens para cada
                usina.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Entradas</span>
                <strong>{currency(crmFinanceiroResumo.entradas)}</strong>
              </div>
              <div>
                <span>Saídas</span>
                <strong>{currency(crmFinanceiroResumo.saidas)}</strong>
              </div>
              <div>
                <span>Saldo acumulado</span>
                <strong>{currency(crmFinanceiroResumo.saldo)}</strong>
              </div>
              <div>
                <span>Contratos ativos</span>
                <strong>{crmFinanceiroResumo.contratosAtivos}</strong>
              </div>
              <div className="warning">
                <span>Inadimplentes</span>
                <strong>{crmFinanceiroResumo.inadimplentes}</strong>
              </div>
            </div>
          </div>
          <div className="crm-finance-grid">
            {/* Coluna 1: formulários de contratos, lançamentos e custos para alimentar o financeiro do CRM. */}
            <div className="crm-finance-forms">
              <form onSubmit={handleSalvarContratoCrm} className="crm-form">
                <fieldset>
                  <legend>Contrato financeiro</legend>
                  <label>
                    Lead
                    <select
                      value={crmContratoForm.leadId}
                      onChange={(event) => setCrmContratoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                    >
                      <option value="">{crmLeadSelecionado ? 'Usar lead selecionado' : 'Selecione um lead'}</option>
                      {crmDataset.leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modelo
                    <select
                      value={crmContratoForm.modelo}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          modelo: event.target.value as 'LEASING' | 'VENDA_DIRETA',
                        }))
                      }
                    >
                      <option value="LEASING">Leasing</option>
                      <option value="VENDA_DIRETA">Venda</option>
                    </select>
                  </label>
                  <div className="crm-form-row">
                    <label>
                      Valor total (R$)
                      <input
                        value={crmContratoForm.valorTotal}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorTotal: event.target.value }))
                        }
                        placeholder="Ex: 250000"
                      />
                    </label>
                    <label>
                      Entrada (R$)
                      <input
                        value={crmContratoForm.entrada}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, entrada: event.target.value }))
                        }
                        placeholder="Ex: 50000"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Parcelas
                      <input
                        value={crmContratoForm.parcelas}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, parcelas: event.target.value }))
                        }
                        placeholder="Ex: 36"
                      />
                    </label>
                    <label>
                      Valor parcela (R$)
                      <input
                        value={crmContratoForm.valorParcela}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorParcela: event.target.value }))
                        }
                        placeholder="Ex: 4200"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Reajuste anual (%)
                      <input
                        value={crmContratoForm.reajusteAnualPct}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, reajusteAnualPct: event.target.value }))
                        }
                        placeholder="Ex: 3"
                      />
                    </label>
                    <label>
                      Primeiro vencimento
                      <input
                        type="date"
                        value={crmContratoForm.vencimentoInicialIso}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, vencimentoInicialIso: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Status
                    <select
                      value={crmContratoForm.status}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          status: event.target.value as CrmFinanceiroStatus,
                        }))
                      }
                    >
                      <option value="em-aberto">Em aberto</option>
                      <option value="ativo">Ativo</option>
                      <option value="inadimplente">Inadimplente</option>
                      <option value="quitado">Quitado</option>
                    </select>
                  </label>
                </fieldset>
                <button type="submit" className="primary">
                  Salvar contrato
                </button>
              </form>

              <form onSubmit={handleRegistrarLancamentoCrm} className="crm-form">
                <fieldset>
                  <legend>Lançamento de caixa</legend>
                  <div className="crm-form-row">
                    <label>
                      Data
                      <input
                        type="date"
                        value={crmLancamentoForm.dataIso}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({ ...prev, dataIso: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={crmLancamentoForm.tipo}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            tipo: event.target.value as CrmLancamentoCaixa['tipo'],
                          }))
                        }
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Categoria
                      <select
                        value={crmLancamentoForm.categoria}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            categoria: event.target.value as CrmLancamentoCaixa['categoria'],
                          }))
                        }
                      >
                        {CRM_FINANCEIRO_CATEGORIAS.map((categoria) => (
                          <option key={categoria} value={categoria}>
                            {categoria}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Forma de pagamento
                      <select
                        value={crmLancamentoForm.formaPagamento}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            formaPagamento: event.target.value as CrmLancamentoCaixa['formaPagamento'],
                          }))
                        }
                      >
                        {CRM_FORMAS_PAGAMENTO.map((forma) => (
                          <option key={forma} value={forma}>
                            {forma}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Origem do lançamento
                    <input
                      value={crmLancamentoForm.origem}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, origem: event.target.value }))}
                      placeholder="Leasing, venda direta, manutenção..."
                    />
                  </label>
                  <label>
                    Valor (R$)
                    <input
                      value={crmLancamentoForm.valor}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, valor: event.target.value }))}
                      placeholder="Ex: 1800"
                    />
                  </label>
                  <label>
                    Associar a lead (opcional)
                    <select
                      value={crmLancamentoForm.leadId}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                    >
                      <option value="">Usar lead selecionado</option>
                      {crmDataset.leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Observação
                    <textarea
                      rows={2}
                      value={crmLancamentoForm.observacao}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, observacao: event.target.value }))}
                    />
                  </label>
                </fieldset>
                <button type="submit" className="ghost">
                  Registrar lançamento
                </button>
              </form>

              <form onSubmit={handleSalvarCustosCrm} className="crm-form">
                <fieldset>
                  <legend>Custos do projeto selecionado</legend>
                  <div className="crm-form-row">
                    <label>
                      Equipamentos (R$)
                      <input
                        value={crmCustosForm.equipamentos}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, equipamentos: event.target.value }))}
                      />
                    </label>
                    <label>
                      Mão de obra (R$)
                      <input
                        value={crmCustosForm.maoDeObra}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, maoDeObra: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Deslocamento (R$)
                      <input
                        value={crmCustosForm.deslocamento}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, deslocamento: event.target.value }))}
                      />
                    </label>
                    <label>
                      Taxas e seguros (R$)
                      <input
                        value={crmCustosForm.taxasSeguros}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, taxasSeguros: event.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
                <button type="submit" className="ghost">
                  Salvar custos
                </button>
              </form>
            </div>
            {/* Coluna 2: painéis analíticos que resumem fluxo de caixa e margens. */}
            <div className="crm-finance-analytics">
              <div className="crm-flow-chart">
                <h3>Fluxo de caixa consolidado</h3>
                {crmFinanceiroResumo.fluxoOrdenado.length === 0 ? (
                  <p className="crm-empty">Cadastre lançamentos para visualizar o fluxo de caixa.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={crmFinanceiroResumo.fluxoOrdenado}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.15)" strokeDasharray="6 6" />
                      <XAxis dataKey="data" tickFormatter={(valor) => valor.slice(5)} stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" tickFormatter={formatAxis} width={90} />
                      <Tooltip
                        formatter={(value: number) => currency(value)}
                        labelFormatter={(label) => `Dia ${label}`}
                        contentStyle={{
                          background: 'rgba(15,22,36,0.96)',
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.2)',
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="saldoAcumulado"
                        name="Saldo acumulado"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={false}
                      />
                      <ReferenceLine y={0} stroke="rgba(239,68,68,0.45)" strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="crm-margins">
                <h3>ROI e margens por lead</h3>
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Modelo</th>
                      <th>Receita (R$)</th>
                      <th>Custos (R$)</th>
                      <th>Margem bruta (R$)</th>
                      <th>Margem (%)</th>
                      <th>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmFinanceiroResumo.margens.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="crm-empty">
                          Informe contratos e custos para acompanhar margens e ROI de cada projeto.
                        </td>
                      </tr>
                    ) : (
                      crmFinanceiroResumo.margens.map((item) => (
                        <tr key={item.leadId}>
                          <td>{item.leadNome}</td>
                          <td>{item.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</td>
                          <td>{currency(item.receitaProjetada)}</td>
                          <td>{currency(item.custoTotal)}</td>
                          <td>{currency(item.margemBruta)}</td>
                          <td>{item.margemPct === null ? '—' : `${item.margemPct.toFixed(1)}%`}</td>
                          <td>{item.roi === null ? '—' : `${(item.roi * 100).toFixed(1)}%`}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 7 - Inteligência e relatórios */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>7. Inteligência e relatórios</h2>
              <p>
                Indicadores consolidados da operação comercial, técnica e financeira da SolarInvest, com alertas de
                gargalos.
              </p>
            </div>
          </div>
          <div className="crm-insights-grid">
            {/* Painéis estratégicos conectando marketing, operação técnica e finanças. */}
            <div className="crm-insight-panel">
              <h3>Métricas principais</h3>
              <ul className="crm-kpi-list">
                <li>
                  <span>Taxa de conversão</span>
                  <strong>{crmIndicadoresGerenciais.taxaConversao}%</strong>
                </li>
                <li>
                  <span>Tempo médio de fechamento</span>
                  <strong>{crmIndicadoresGerenciais.tempoMedioFechamento} dias</strong>
                </li>
                <li>
                  <span>ROI médio</span>
                  <strong>
                    {Number.isFinite(crmIndicadoresGerenciais.roiMedio)
                      ? `${(crmIndicadoresGerenciais.roiMedio * 100).toFixed(1)}%`
                      : '—'}
                  </strong>
                </li>
                <li>
                  <span>Receita recorrente projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaRecorrenteProjetada)}</strong>
                </li>
                <li>
                  <span>Receita pontual projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaPontualProjetada)}</strong>
                </li>
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Origem dos leads</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.leadsPorOrigem).map(([origem, quantidade]) => (
                  <li key={origem}>
                    <span>{origem}</span>
                    <strong>{quantidade}</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.leadsPorOrigem).length === 0 ? (
                  <li className="crm-empty">Cadastre leads para visualizar a distribuição de origens.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Mapa de geração por cidade</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.mapaGeracao).map(([cidade, consumo]) => (
                  <li key={cidade}>
                    <span>{cidade}</span>
                    <strong>{consumo} kWh</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.mapaGeracao).length === 0 ? (
                  <li className="crm-empty">Nenhum dado de geração disponível. Feche contratos para popular o mapa.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Alertas de gargalos</h3>
              {crmIndicadoresGerenciais.gargalos.length === 0 ? (
                <p className="crm-empty">O funil está saudável, sem gargalos detectados.</p>
              ) : (
                <ul className="crm-alert-list">
                  {crmIndicadoresGerenciais.gargalos.map((texto, index) => (
                    <li key={texto + index}>{texto}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )

  const handleSalvarCliente = useCallback(async () => {
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
      const existingIds = new Set(prevRegistros.map((registro) => registro.id))
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
          const novoRegistro: ClienteRegistro = {
            id: generateClienteId(existingIds),
            criadoEm: agoraIso,
            atualizadoEm: agoraIso,
            dados: dadosClonados,
          }
          registroAtualizado = novoRegistro
          registrosAtualizados = [novoRegistro, ...prevRegistros]
        }
      } else {
        const novoRegistro: ClienteRegistro = {
          id: generateClienteId(existingIds),
          criadoEm: agoraIso,
          atualizadoEm: agoraIso,
          dados: dadosClonados,
        }
        registroAtualizado = novoRegistro
        registrosAtualizados = [novoRegistro, ...prevRegistros]
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

    const salvo = registroSalvo as ClienteRegistro | null
    if (houveErro || !salvo) {
      return
    }

    const registroConfirmado: ClienteRegistro = salvo
    let sincronizadoComSucesso = false
    let erroSincronizacao: unknown = null

    try {
      await persistClienteRegistroToOneDrive(mapClienteRegistroToSyncPayload(registroConfirmado))
      sincronizadoComSucesso = true
    } catch (error) {
      erroSincronizacao = error
      console.error('Erro ao sincronizar cliente com o OneDrive.', error)
    }

    setClienteEmEdicaoId(registroConfirmado.id)

    if (sincronizadoComSucesso) {
      adicionarNotificacao(
        estaEditando
          ? 'Dados do cliente atualizados e sincronizados com o OneDrive com sucesso.'
          : 'Cliente salvo e sincronizado com o OneDrive com sucesso.',
        'success',
      )
    } else {
      const mensagemErro =
        erroSincronizacao instanceof Error && erroSincronizacao.message
          ? erroSincronizacao.message
          : 'Erro desconhecido ao sincronizar com o OneDrive.'
      adicionarNotificacao(
        `Cliente salvo localmente, mas houve erro ao sincronizar com o OneDrive. ${mensagemErro}`,
        'error',
      )
    }
  }, [
    adicionarNotificacao,
    cliente,
    clienteEmEdicaoId,
    persistClienteRegistroToOneDrive,
    setClienteEmEdicaoId,
    validarCamposObrigatorios,
  ])

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

      const clientesRegistrados = carregarClientesSalvos()
      const clienteIdPorDocumento = new Map<string, string>()
      const clienteIdPorUc = new Map<string, string>()

      clientesRegistrados.forEach((clienteRegistro) => {
        const documento = normalizeNumbers(clienteRegistro.dados.documento ?? '')
        if (documento && !clienteIdPorDocumento.has(documento)) {
          clienteIdPorDocumento.set(documento, clienteRegistro.id)
        }

        const uc = normalizeText(clienteRegistro.dados.uc ?? '')
        if (uc && !clienteIdPorUc.has(uc)) {
          clienteIdPorUc.set(uc, clienteRegistro.id)
        }
      })

      const sanitizeClienteId = (valor: unknown) => {
        if (typeof valor !== 'string') {
          return ''
        }

        const normalizado = normalizeClienteIdCandidate(valor)
        if (normalizado.length === CLIENTE_ID_LENGTH && CLIENTE_ID_PATTERN.test(normalizado)) {
          return normalizado
        }

        return ''
      }

      return parsed.map((item) => {
        const registro = item as Partial<OrcamentoSalvo> & { clienteID?: string }
        const dados = registro.dados as PrintableProps
        const clienteDados = (dados?.cliente ?? {}) as Partial<ClienteDados>
        const dadosNormalizados: PrintableProps = {
          ...dados,
          budgetId: dados?.budgetId ?? registro.id,
          cliente: {
            ...clienteDados,
            cep: clienteDados.cep ?? '',
          },
          distribuidoraTarifa: dados.distribuidoraTarifa ?? clienteDados.distribuidora ?? '',
          tipoProposta: dados?.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }

        const clienteIdArmazenado =
          sanitizeClienteId(
            registro.clienteId ??
              registro.clienteID ??
              (dadosNormalizados as unknown as { clienteId?: string }).clienteId ??
              ((dadosNormalizados.cliente as unknown as { id?: string })?.id ?? ''),
          )

        const documentoRaw = registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? ''
        const ucRaw = registro.clienteUc ?? dadosNormalizados.cliente.uc ?? ''

        let clienteId = clienteIdArmazenado

        if (!clienteId) {
          const documentoDigits = normalizeNumbers(documentoRaw)
          if (documentoDigits) {
            clienteId = clienteIdPorDocumento.get(documentoDigits) ?? ''
          }
        }

        if (!clienteId) {
          const ucTexto = normalizeText(ucRaw)
          if (ucTexto) {
            clienteId = clienteIdPorUc.get(ucTexto) ?? ''
          }
        }

        return {
          ...registro,
          clienteId: clienteId || undefined,
          clienteDocumento: registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? '',
          clienteUc: registro.clienteUc ?? dadosNormalizados.cliente.uc ?? '',
          dados: dadosNormalizados,
        }
      })
    } catch (error) {
      console.warn('Não foi possível interpretar os orçamentos salvos existentes.', error)
      return []
    }
  }, [carregarClientesSalvos])

  const salvarOrcamentoLocalmente = useCallback(
    (dados: PrintableProps): OrcamentoSalvo | null => {
      if (typeof window === 'undefined') {
        return null
      }

      try {
        const registrosExistentes = carregarOrcamentosSalvos()
        const existingIds = new Set(registrosExistentes.map((registro) => registro.id))
        const novoId = generateBudgetId(existingIds)
        const dadosClonados = clonePrintableData(dados)
        const registro: OrcamentoSalvo = {
          id: novoId,
          criadoEm: new Date().toISOString(),
          clienteId: clienteEmEdicaoId ?? undefined,
          clienteNome: dados.cliente.nome,
          clienteCidade: dados.cliente.cidade,
          clienteUf: dados.cliente.uf,
          clienteDocumento: dados.cliente.documento,
          clienteUc: dados.cliente.uc,
          dados: { ...dadosClonados, budgetId: dadosClonados.budgetId ?? novoId },
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
    },
    [carregarOrcamentosSalvos, clienteEmEdicaoId],
  )

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
  const handlePrint = async () => {
    if (!validarCamposObrigatorios()) {
      return
    }

    const resultado = await prepararPropostaParaExportacao()

    if (!resultado) {
      window.alert('Não foi possível gerar a visualização para impressão. Tente novamente.')
      return
    }

    const { html: layoutHtml, dados } = resultado
    const nomeCliente = dados.cliente.nome?.trim() || 'SolarInvest'
    openBudgetPreviewWindow(layoutHtml, {
      nomeCliente,
      budgetId: dados.budgetId,
      actionMessage: 'Revise o conteúdo e utilize as ações para gerar o PDF.',
      initialMode: 'preview',
    })
  }

  const handleSalvarPropostaPdf = useCallback(async () => {
    if (salvandoPropostaPdf) {
      return
    }

    if (!validarCamposObrigatorios('salvar a proposta')) {
      return
    }

    setSalvandoPropostaPdf(true)

    let salvouLocalmente = false

    try {
      const resultado = await prepararPropostaParaExportacao()

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar em PDF. Tente novamente.')
        return
      }

      const { html, dados } = resultado
      salvouLocalmente = Boolean(salvarOrcamentoLocalmente(dados))
      const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'

      await persistProposalPdf({
        html,
        budgetId: dados.budgetId,
        clientName: dados.cliente.nome,
        proposalType,
      })

      const mensagemSucesso = salvouLocalmente
        ? 'Proposta salva em PDF com sucesso. Uma cópia foi armazenada localmente.'
        : 'Proposta salva em PDF com sucesso.'
      adicionarNotificacao(mensagemSucesso, 'success')
    } catch (error) {
      console.error('Erro ao salvar a proposta em PDF.', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível salvar a proposta em PDF. Tente novamente.'
      const mensagemComFallback = salvouLocalmente
        ? `${mensagem} Uma cópia foi armazenada localmente no histórico de orçamentos.`
        : mensagem
      adicionarNotificacao(mensagemComFallback, 'error')
    } finally {
      setSalvandoPropostaPdf(false)
    }
  }, [
    activeTab,
    adicionarNotificacao,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaPdf,
    validarCamposObrigatorios,
  ])

  const handleNovaProposta = useCallback(() => {
    setActivePage('app')
    setActiveTab(INITIAL_ACTIVE_TAB)
    setSettingsTab(INITIAL_SETTINGS_TAB)
    setIsSettingsOpen(false)
    setIsBudgetSearchOpen(false)
    setOrcamentoSearchTerm('')
    setCurrentBudgetId(undefined)
    setKitBudget(createEmptyKitBudget())
    setIsBudgetProcessing(false)
    setBudgetProcessingError(null)
    if (budgetUploadInputRef.current) {
      budgetUploadInputRef.current.value = ''
    }

    setUfTarifa(INITIAL_UF_TARIFA)
    setDistribuidoraTarifa(INITIAL_DISTRIBUIDORA_TARIFA)
    setMesReajuste(INITIAL_MES_REAJUSTE)
    mesReferenciaRef.current = new Date().getMonth() + 1
    setKcKwhMes(INITIAL_KC_KWH_MES)
    setTarifaCheia(INITIAL_TARIFA_CHEIA)
    setDesconto(INITIAL_DESCONTO)
    setTaxaMinima(INITIAL_TAXA_MINIMA)
    setEncargosFixosExtras(INITIAL_ENCARGOS_FIXOS_EXTRAS)
    setLeasingPrazo(INITIAL_LEASING_PRAZO)
    setPotenciaPlaca(INITIAL_POTENCIA_PLACA)
    setTipoInstalacao(INITIAL_TIPO_INSTALACAO)
    setNumeroPlacasManual(INITIAL_NUMERO_PLACAS_MANUAL)
    setCapexManualOverride(INITIAL_CAPEX_MANUAL_OVERRIDE)

    setPrecoPorKwp(INITIAL_PRECO_POR_KWP)
    setIrradiacao(IRRADIACAO_FALLBACK)
    setEficiencia(INITIAL_EFICIENCIA)
    setDiasMes(INITIAL_DIAS_MES)
    setInflacaoAa(INITIAL_INFLACAO_AA)

    setVendaForm(createInitialVendaForm())
    setVendaFormErrors({})
    resetRetorno()

    setJurosFinAa(INITIAL_JUROS_FIN_AA)
    setPrazoFinMeses(INITIAL_PRAZO_FIN_MESES)
    setEntradaFinPct(INITIAL_ENTRADA_FIN_PCT)
    setMostrarFinanciamento(INITIAL_MOSTRAR_FINANCIAMENTO)
    setMostrarGrafico(INITIAL_MOSTRAR_GRAFICO)

    setPrazoMeses(INITIAL_PRAZO_MESES)
    setBandeiraEncargo(INITIAL_BANDEIRA_ENCARGO)
    setCipEncargo(INITIAL_CIP_ENCARGO)
    setEntradaRs(INITIAL_ENTRADA_RS)
    setEntradaModo(INITIAL_ENTRADA_MODO)
    setMostrarTabelaParcelas(INITIAL_TABELA_VISIVEL)
    setMostrarTabelaBuyout(INITIAL_TABELA_VISIVEL)
    setMostrarTabelaParcelasConfig(INITIAL_TABELA_VISIVEL)
    setMostrarTabelaBuyoutConfig(INITIAL_TABELA_VISIVEL)
    setSalvandoPropostaPdf(false)

    setOemBase(INITIAL_OEM_BASE)
    setOemInflacao(INITIAL_OEM_INFLACAO)
    setSeguroModo(INITIAL_SEGURO_MODO)
    setSeguroReajuste(INITIAL_SEGURO_REAJUSTE)
    setSeguroValorA(INITIAL_SEGURO_VALOR_A)
    setSeguroPercentualB(INITIAL_SEGURO_PERCENTUAL_B)
    setExibirLeasingLinha(INITIAL_EXIBIR_LEASING_LINHA)
    setExibirFinLinha(INITIAL_EXIBIR_FIN_LINHA)

    setCashbackPct(INITIAL_CASHBACK_PCT)
    setDepreciacaoAa(INITIAL_DEPRECIACAO_AA)
    setInadimplenciaAa(INITIAL_INADIMPLENCIA_AA)
    setTributosAa(INITIAL_TRIBUTOS_AA)
    setIpcaAa(INITIAL_IPCA_AA)
    setCustosFixosM(INITIAL_CUSTOS_FIXOS_M)
    setOpexM(INITIAL_OPEX_M)
    setSeguroM(INITIAL_SEGURO_M)
    setDuracaoMeses(INITIAL_DURACAO_MESES)
    setPagosAcumAteM(INITIAL_PAGOS_ACUM_ATE_M)

    setCliente({ ...CLIENTE_INICIAL })
    setClienteMensagens({})
    setClienteEmEdicaoId(null)
    setIsClientesModalOpen(false)
    setNotificacoes([])
  }, [resetRetorno])

  const allCurvesHidden = !exibirLeasingLinha && (!mostrarFinanciamento || !exibirFinLinha)
  const podeSalvarProposta = activeTab === 'leasing' || activeTab === 'vendas'

  const handleClienteChange = (key: keyof ClienteDados, value: string) => {
    let nextValue = value

    if (key === 'documento') {
      nextValue = formatCpfCnpj(value)
    } else if (key === 'email') {
      nextValue = value.trim()
    } else if (key === 'telefone') {
      nextValue = formatTelefone(value)
    } else if (key === 'cep') {
      nextValue = formatCep(value)
    } else if (key === 'uf') {
      nextValue = value.toUpperCase()
      setCliente((prev) => {
        const ufNormalizada = nextValue
        const listaDistribuidoras = distribuidorasPorUf[ufNormalizada] ?? []
        let proximaDistribuidora = prev.distribuidora

        if (listaDistribuidoras.length === 1) {
          proximaDistribuidora = listaDistribuidoras[0]
        } else if (proximaDistribuidora && !listaDistribuidoras.includes(proximaDistribuidora)) {
          proximaDistribuidora = ''
        }

        if (prev.uf === ufNormalizada && prev.distribuidora === proximaDistribuidora) {
          return prev
        }

        return { ...prev, uf: ufNormalizada, distribuidora: proximaDistribuidora }
      })
      return
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

    const cepNumeros = normalizeNumbers(cliente.cep)
    if (cepNumeros.length < 8) {
      setBuscandoCep(false)
      setClienteMensagens((prev) => ({ ...prev, cep: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setBuscandoCep(true)
      setClienteMensagens((prev) => ({ ...prev, cep: undefined }))

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Falha ao consultar CEP.')
        }

        const data: ViaCepResponse = await response.json()
        if (!ativo) {
          return
        }

        if (data?.erro) {
          setClienteMensagens((prev) => ({ ...prev, cep: 'CEP não encontrado.' }))
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.localidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''

        setCliente((prev) => {
          let alterado = false
          const proximo: ClienteDados = { ...prev }

          if (logradouro && logradouro !== prev.endereco) {
            proximo.endereco = logradouro
            alterado = true
          }

          if (localidade && localidade !== prev.cidade) {
            proximo.cidade = localidade
            alterado = true
          }

          if (uf && uf !== prev.uf) {
            proximo.uf = uf
            alterado = true
          }

          if (!alterado) {
            return prev
          }

          return proximo
        })

        setClienteMensagens((prev) => ({ ...prev, cep: undefined, cidade: undefined }))
      } catch (error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cep: 'Não foi possível consultar o CEP agora.',
        }))
      } finally {
        if (ativo) {
          setBuscandoCep(false)
        }
      }
    }

    consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [cliente.cep])

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
        const dadosParaImpressao: PrintableProps = {
          ...registro.dados,
          budgetId: registro.dados.budgetId ?? registro.id,
          tipoProposta:
            registro.dados.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }
        const layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao)
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
          initialMode: modo === 'download' ? 'download' : modo === 'print' ? 'print' : 'preview',
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
      const clienteIdTexto = normalizeText(registro.clienteId ?? '')
      const clienteIdDigits = normalizeNumbers(registro.clienteId ?? '')
      const documentoRaw = registro.clienteDocumento || registro.dados.cliente.documento || ''
      const documentoTexto = normalizeText(documentoRaw)
      const documentoDigits = normalizeNumbers(documentoRaw)
      const ucRaw = registro.clienteUc || registro.dados.cliente.uc || ''
      const ucTexto = normalizeText(ucRaw)
      const ucDigits = normalizeNumbers(ucRaw)

      if (
        codigo.includes(queryText) ||
        nome.includes(queryText) ||
        clienteIdTexto.includes(queryText) ||
        documentoTexto.includes(queryText) ||
        ucTexto.includes(queryText)
      ) {
        return true
      }

      if (!queryDigits) {
        return false
      }

      return (
        codigoDigits.includes(queryDigits) ||
        clienteIdDigits.includes(queryDigits) ||
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

  const renderVendaParametrosSection = () => (
    <section className="card">
      <h2>Parâmetros principais</h2>
      <div className="grid g3">
        <Field
          label={
            <>
              Consumo (kWh/mês)
              <InfoTooltip text="Consumo médio mensal utilizado para projetar a geração e a economia." />
            </>
          }
        >
          <input
            type="number"
            min={0}
            value={
              Number.isFinite(vendaForm.consumo_kwh_mes) ? vendaForm.consumo_kwh_mes : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setKcKwhMes(normalized)
              applyVendaUpdates({ consumo_kwh_mes: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.consumo_kwh_mes} />
        </Field>
        <Field label="Tarifa cheia (R$/kWh)">
          <input
            type="number"
            step="0.001"
            min={0}
            value={
              Number.isFinite(vendaForm.tarifa_cheia_r_kwh)
                ? vendaForm.tarifa_cheia_r_kwh
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setTarifaCheia(normalized)
              applyVendaUpdates({ tarifa_cheia_r_kwh: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.tarifa_cheia_r_kwh} />
        </Field>
        <Field label="Taxa mínima (R$/mês)">
          <input
            type="number"
            min={0}
            value={
              Number.isFinite(vendaForm.taxa_minima_mensal)
                ? vendaForm.taxa_minima_mensal
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setTaxaMinima(normalized)
              applyVendaUpdates({ taxa_minima_mensal: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_minima_mensal} />
        </Field>
      </div>
      <div className="grid g3">
        <Field
          label={
            <>
              Inflação de energia (% a.a.)
              <InfoTooltip text="Reajuste anual estimado para a tarifa de energia." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            value={
              Number.isFinite(vendaForm.inflacao_energia_aa_pct)
                ? vendaForm.inflacao_energia_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setInflacaoAa(normalized)
              applyVendaUpdates({ inflacao_energia_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Horizonte de análise (meses)">
          <input
            type="number"
            min={1}
            step={1}
            value={
              Number.isFinite(vendaForm.horizonte_meses) ? vendaForm.horizonte_meses : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed)
                ? Math.max(1, Math.round(parsed))
                : 1
              applyVendaUpdates({ horizonte_meses: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.horizonte_meses} />
        </Field>
        <Field
          label={
            <>
              Taxa de desconto (% a.a.)
              <InfoTooltip text="Opcional: utilizada para calcular o Valor Presente Líquido (VPL)." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            min={0}
            value={
              Number.isFinite(vendaForm.taxa_desconto_aa_pct)
                ? vendaForm.taxa_desconto_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (event.target.value === '') {
                applyVendaUpdates({ taxa_desconto_aa_pct: undefined })
                return
              }
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              applyVendaUpdates({ taxa_desconto_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_desconto_aa_pct} />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="UF (ANEEL)">
          <select value={ufTarifa} onChange={(event) => setUfTarifa(event.target.value)}>
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
            onChange={(event) => setDistribuidoraTarifa(event.target.value)}
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
              <InfoTooltip text="Valor sugerido automaticamente conforme a UF ou distribuidora." />
            </>
          }
          hint="Atualizado automaticamente conforme a região selecionada."
        >
          <input readOnly value={baseIrradiacao > 0 ? baseIrradiacao.toFixed(2) : '—'} />
        </Field>
      </div>
    </section>
  )

  const renderVendaConfiguracaoSection = () => (
    <section className="card">
      <h2>Configuração da Usina Fotovoltaica</h2>
      <div className="grid g4">
        <Field label="Potência da placa (Wp)">
          <select value={potenciaPlaca} onChange={(event) => setPotenciaPlaca(Number(event.target.value))}>
            {painelOpcoes.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nº de placas (estimado)">
          <input
            type="number"
            min={1}
            value={
              Number.isFinite(vendaForm.quantidade_modulos)
                ? vendaForm.quantidade_modulos
                : ''
            }
            onChange={(event) => {
              const { value } = event.target
              if (!value) {
                applyVendaUpdates({ quantidade_modulos: undefined })
                setNumeroPlacasManual('')
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                applyVendaUpdates({ quantidade_modulos: undefined })
                setNumeroPlacasManual('')
                return
              }
              const inteiro = Math.max(1, Math.round(parsed))
              applyVendaUpdates({ quantidade_modulos: inteiro })
              setNumeroPlacasManual(inteiro)
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
        <Field label="Potência instalada (kWp)">
          <input
            type="number"
            step="0.01"
            min={0}
            value={
              Number.isFinite(vendaForm.potencia_instalada_kwp)
                ? vendaForm.potencia_instalada_kwp
                : ''
            }
            onChange={(event) => {
              const { value } = event.target
              if (!value) {
                applyVendaUpdates({ potencia_instalada_kwp: undefined })
                return
              }
              const parsed = Number(value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              applyVendaUpdates({ potencia_instalada_kwp: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Geração estimada (kWh/mês)">
          <input
            type="number"
            min={0}
            value={
              Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
                ? vendaForm.geracao_estimada_kwh_mes
                : ''
            }
            onChange={(event) => {
              const { value } = event.target
              if (!value) {
                applyVendaUpdates({ geracao_estimada_kwh_mes: undefined })
                return
              }
              const parsed = Number(value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              applyVendaUpdates({ geracao_estimada_kwh_mes: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field label="Área utilizada (m²)">
          <input
            readOnly
            value={
              areaInstalacao > 0
                ? areaInstalacao.toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                : '—'
            }
          />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="Modelo do módulo">
          <input
            type="text"
            value={vendaForm.modelo_modulo ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_modulo: event.target.value || undefined })}
          />
        </Field>
        <Field label="Modelo do inversor">
          <input
            type="text"
            value={vendaForm.modelo_inversor ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_inversor: event.target.value || undefined })}
          />
        </Field>
        <Field label="Estrutura de fixação">
          <input
            type="text"
            value={vendaForm.estrutura_suporte ?? ''}
            onChange={(event) =>
              applyVendaUpdates({ estrutura_suporte: event.target.value || undefined })
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
          <InfoTooltip text="Consumo diário estimado = Geração mensal ÷ 30 dias." />
          Consumo diário
          <strong>{geracaoDiariaKwh.toFixed(1)} kWh</strong>
        </span>
      </div>
    </section>
  )

  const renderCondicoesPagamentoSection = () => {
    const condicao = vendaForm.condicao
    return (
      <section className="card">
        <h2>Condições de Pagamento</h2>
        <div className="grid g3">
          <Field label="Condição">
            <select
              value={condicao}
              onChange={(event) => handleCondicaoPagamentoChange(event.target.value as PagamentoCondicao)}
            >
              <option value="AVISTA">À vista</option>
              <option value="PARCELADO">Parcelado</option>
              <option value="FINANCIAMENTO">Financiamento</option>
            </select>
            <FieldError message={vendaFormErrors.condicao} />
          </Field>
          <Field label="Investimento (CAPEX total)">
            <input
              type="number"
              min={0}
              value={
                Number.isFinite(vendaForm.capex_total) ? vendaForm.capex_total : ''
              }
              onChange={(event) => {
                const parsed = parseNumericInput(event.target.value)
                const normalized = parsed && parsed > 0 ? parsed : 0
                setCapexManualOverride(true)
                applyVendaUpdates({ capex_total: normalized })
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.capex_total} />
          </Field>
          <Field label="Moeda">
            <input readOnly value="BRL" />
          </Field>
        </div>
        {condicao === 'AVISTA' ? (
          <div className="grid g3">
            <Field label="Modo de pagamento">
              <select
                value={vendaForm.modo_pagamento ?? 'PIX'}
                onChange={(event) => applyVendaUpdates({ modo_pagamento: event.target.value as ModoPagamento })}
              >
                <option value="PIX">Pix</option>
                <option value="DEBITO">Cartão de débito</option>
                <option value="CREDITO">Cartão de crédito</option>
              </select>
              <FieldError message={vendaFormErrors.modo_pagamento} />
            </Field>
            <Field label="MDR Pix">
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_pix_pct)
                    ? vendaForm.taxa_mdr_pix_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_pix_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ taxa_mdr_pix_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_pix_pct} />
            </Field>
            <Field label="MDR Débito">
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_debito_pct)
                    ? vendaForm.taxa_mdr_debito_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_debito_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ taxa_mdr_debito_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_debito_pct} />
            </Field>
            <Field label="MDR Crédito à vista">
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_credito_vista_pct)
                    ? vendaForm.taxa_mdr_credito_vista_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_credito_vista_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({
                    taxa_mdr_credito_vista_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                  })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_credito_vista_pct} />
            </Field>
          </div>
        ) : null}
        {condicao === 'PARCELADO' ? (
          <div className="grid g3">
            <Field label="Nº de parcelas">
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(vendaForm.n_parcelas) ? vendaForm.n_parcelas : ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_parcelas: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_parcelas: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_parcelas} />
            </Field>
            <Field label="Juros cartão (% a.m.)">
              <input
                type="number"
                step="0.01"
                value={
                  Number.isFinite(vendaForm.juros_cartao_am_pct)
                    ? vendaForm.juros_cartao_am_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_cartao_am_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_cartao_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_cartao_am_pct} />
            </Field>
            <Field label="Juros cartão (% a.a.)">
              <input
                type="number"
                step="0.1"
                value={
                  Number.isFinite(vendaForm.juros_cartao_aa_pct)
                    ? vendaForm.juros_cartao_aa_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_cartao_aa_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_cartao_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_cartao_aa_pct} />
            </Field>
            <Field label="MDR crédito parcelado">
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_credito_parcelado_pct)
                    ? vendaForm.taxa_mdr_credito_parcelado_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ taxa_mdr_credito_parcelado_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({
                    taxa_mdr_credito_parcelado_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                  })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_credito_parcelado_pct} />
            </Field>
          </div>
        ) : null}
        {condicao === 'FINANCIAMENTO' ? (
          <div className="grid g3">
            <Field label="Entrada (R$)">
              <input
                type="number"
                min={0}
                value={
                  Number.isFinite(vendaForm.entrada_financiamento)
                    ? vendaForm.entrada_financiamento
                    : ''
                }
                onChange={(event) => {
                  const parsed = parseNumericInput(event.target.value)
                  const normalized = parsed && parsed > 0 ? parsed : 0
                  applyVendaUpdates({ entrada_financiamento: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.entrada_financiamento} />
            </Field>
            <Field label="Nº de parcelas">
              <input
                type="number"
                min={1}
                step={1}
                value={
                  Number.isFinite(vendaForm.n_parcelas_fin)
                    ? vendaForm.n_parcelas_fin
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_parcelas_fin: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_parcelas_fin: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_parcelas_fin} />
            </Field>
            <Field label="Juros financiamento (% a.m.)">
              <input
                type="number"
                step="0.01"
                value={
                  Number.isFinite(vendaForm.juros_fin_am_pct)
                    ? vendaForm.juros_fin_am_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_fin_am_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_fin_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_fin_am_pct} />
            </Field>
            <Field label="Juros financiamento (% a.a.)">
              <input
                type="number"
                step="0.1"
                value={
                  Number.isFinite(vendaForm.juros_fin_aa_pct)
                    ? vendaForm.juros_fin_aa_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_fin_aa_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_fin_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_fin_aa_pct} />
            </Field>
          </div>
        ) : null}
      </section>
    )
  }

  const renderRetornoProjetadoSection = () => {
    const resultado = retornoProjetado
    const meses = resultado ? resultado.economia.map((_, index) => index) : []
    const horizonte = vendaForm.horizonte_meses
    const paybackLabel = resultado?.payback
      ? `${resultado.payback} meses`
      : 'Não atingido no horizonte analisado'
    const roiLabel = resultado
      ? new Intl.NumberFormat('pt-BR', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(resultado.roi)
      : '—'
    const vplLabel =
      resultado && typeof resultado.vpl === 'number' ? currency(resultado.vpl) : '—'

    return (
      <section className="card">
        <div className="card-header">
          <h2>Retorno Projetado</h2>
          <button
            type="button"
            className="primary"
            onClick={handleCalcularRetorno}
            disabled={retornoStatus === 'calculating'}
          >
            {retornoStatus === 'calculating'
              ? 'Calculando…'
              : resultado
              ? 'Recalcular retorno'
              : 'Calcular retorno'}
          </button>
        </div>
        {retornoError ? <p className="field-error">{retornoError}</p> : null}
        {resultado ? (
          <>
            <div className="kpi-grid">
              <div className="kpi">
                <span>Payback estimado</span>
                <strong>{paybackLabel}</strong>
              </div>
              <div className="kpi">
                <span>ROI acumulado ({horizonte} meses)</span>
                <strong>{roiLabel}</strong>
              </div>
              <div className="kpi">
                <span>VPL</span>
                <strong>{vplLabel}</strong>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Economia</th>
                    <th>Pagamento</th>
                    <th>Fluxo líquido</th>
                    <th>Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((mes) => (
                    <tr key={`retorno-m-${mes}`}>
                      <td>{mes}</td>
                      <td>{currency(resultado.economia[mes] ?? 0)}</td>
                      <td>{currency(resultado.pagamentoMensal[mes] ?? 0)}</td>
                      <td>{currency(resultado.fluxo[mes] ?? 0)}</td>
                      <td>{currency(resultado.saldo[mes] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : retornoStatus === 'calculating' ? (
          <p className="muted">Calculando projeções…</p>
        ) : (
          <p className="muted">Preencha os dados e clique em “Calcular retorno”.</p>
        )}
      </section>
    )
  }

  return (
    <>
      {activePage === 'crm' ? (
        renderCrmPage()
      ) : (
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
          {/* Botão dedicado ao CRM para acesso rápido, mantendo posição à esquerda do buscador de orçamentos. */}
          <button className="crm-button" onClick={() => setActivePage('crm')}>
            Central CRM
          </button>
          <button className="ghost" onClick={abrirPesquisaOrcamentos}>Pesquisar</button>
          <button className="ghost" onClick={handlePrint}>Exportar PDF</button>
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
          <div className="page-actions">
            <div className="page-actions-left">
              <button type="button" className="ghost" onClick={handleNovaProposta}>
                Novo
              </button>
            </div>
            {podeSalvarProposta ? (
              <div className="page-actions-right">
                <button
                  type="button"
                  className="primary"
                  onClick={handleSalvarPropostaPdf}
                  disabled={salvandoPropostaPdf}
                >
                  {salvandoPropostaPdf ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            ) : null}
          </div>
          {activeTab === 'leasing' ? (
            <>
            {renderParametrosPrincipaisSection()}
            {renderConfiguracaoUsinaSection()}
            <section className="card">
              <div className="card-header">
                <h2>SolarInvest Leasing</h2>
              </div>

              <div className="grid g3">
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
                <Field label="Desconto contratual (%)">
                  <input
                    type="number"
                    step="0.1"
                    value={desconto}
                    onChange={(e) => setDesconto(Number(e.target.value) || 0)}
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
                        <th>Tarifa por kWh</th>
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
                <h2>Leasing — Mensalidades</h2>
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
                  <h2>Financiamento — Mensalidades</h2>
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
                          <strong>Beneficio acumulado em 30 anos:</strong>{' '}
                          <strong style={{ color: chartColors.Leasing }}>{currency(beneficioAno30.Leasing)}</strong>
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
                    <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 20, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="ano"
                        stroke="#E2E8F0"
                        tick={{ fill: '#E2E8F0', fontWeight: 600 }}
                        label={{ value: 'Anos', position: 'insideBottomRight', offset: -5, fill: '#F8FAFC', fontWeight: 700 }}
                      />
                      <YAxis
                        stroke="#E2E8F0"
                        tick={{ fill: '#E2E8F0', fontWeight: 600 }}
                        tickFormatter={formatAxis}
                        domain={yDomain}
                        width={92}
                        label={{ value: 'Beneficio em Reais', angle: -90, position: 'insideLeft', offset: 12, fill: '#F8FAFC', fontWeight: 700 }}
                      />
                      <Tooltip formatter={(value: number) => currency(Number(value))} contentStyle={{ background: '#0b1220', border: '1px solid #1f2b40' }} />
                      <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16 }} />
                      <ReferenceLine y={0} stroke="#475569" />
                      {exibirLeasingLinha ? (
                        <Line
                          type="monotone"
                          dataKey="Leasing"
                          stroke={chartColors.Leasing}
                          strokeWidth={2}
                          dot
                        />
                      ) : null}
                      {mostrarFinanciamento && exibirFinLinha ? (
                        <Line
                          type="monotone"
                          dataKey="Financiamento"
                          stroke={chartColors.Financiamento}
                          strokeWidth={2}
                          dot
                        />
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
                <input
                  value={cliente.telefone}
                  onChange={(e) => handleClienteChange('telefone', e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                />
              </Field>
              <Field label="CEP" hint={buscandoCep ? 'Buscando CEP...' : clienteMensagens.cep}>
                <input
                  value={cliente.cep}
                  onChange={(e) => handleClienteChange('cep', e.target.value)}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                />
              </Field>
              <Field label="Distribuidora (ANEEL)">
                <select
                  value={cliente.distribuidora}
                  onChange={(e) => handleClienteChange('distribuidora', e.target.value)}
                  disabled={!cliente.uf || clienteDistribuidorasDisponiveis.length === 0}
                >
                  <option value="">
                    {cliente.uf ? 'Selecione a distribuidora' : 'Selecione a UF'}
                  </option>
                  {clienteDistribuidorasDisponiveis.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                  {cliente.distribuidora && !clienteDistribuidorasDisponiveis.includes(cliente.distribuidora) ? (
                    <option value={cliente.distribuidora}>{cliente.distribuidora}</option>
                  ) : null}
                </select>
              </Field>
              <Field label="Unidade consumidora (UC)">
                <input value={cliente.uc} onChange={(e) => handleClienteChange('uc', e.target.value)} />
              </Field>
              <Field label="Endereço de instalação">
                <input
                  value={cliente.endereco}
                  onChange={(e) => handleClienteChange('endereco', e.target.value)}
                  autoComplete="street-address"
                />
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
                  {ufsDisponiveis.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf} — {UF_LABELS[uf] ?? uf}
                    </option>
                  ))}
                  {cliente.uf && !ufsDisponiveis.includes(cliente.uf) ? (
                    <option value={cliente.uf}>
                      {cliente.uf} — {UF_LABELS[cliente.uf] ?? cliente.uf}
                    </option>
                  ) : null}
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
            {renderVendaParametrosSection()}
            {renderVendaConfiguracaoSection()}
            <section className="card">
              <h2>Upload de Orçamento em PDF</h2>
              <div className="budget-upload-section">
                <p className="muted">
                  Envie um orçamento em PDF para extrair automaticamente os itens e valores do kit solar.
                </p>
                <div className="budget-upload-control">
                  <input
                    ref={budgetUploadInputRef}
                    id={budgetUploadInputId}
                    className="budget-upload-input"
                    type="file"
                    accept="application/pdf"
                    onChange={handleBudgetFileChange}
                    disabled={isBudgetProcessing}
                  />
                  <label
                    htmlFor={budgetUploadInputId}
                    className={`budget-upload-trigger${isBudgetProcessing ? ' disabled' : ''}`}
                  >
                    <span aria-hidden="true">📄</span>
                    <span>Selecionar PDF</span>
                  </label>
                  <span className="budget-upload-hint">Aceita arquivos no formato .pdf</span>
                  {isBudgetProcessing ? (
                    <span className="budget-upload-status">Processando orçamento...</span>
                  ) : null}
                  {budgetProcessingError ? (
                    <span className="budget-upload-error">{budgetProcessingError}</span>
                  ) : null}
                </div>
              </div>
            </section>
            <section className="card">
              <h2>Orçamento do Kit Solar</h2>
              {kitBudget.fileName ? (
                <p className="budget-upload-file">
                  Arquivo analisado: <strong>{kitBudget.fileName}</strong>
                </p>
              ) : null}
              {kitBudget.warnings.length > 0 ? (
                <ul className="budget-warning-list">
                  {kitBudget.warnings.map((warning, index) => (
                    <li key={`budget-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {kitBudget.items.length === 0 ? (
                <div className="budget-empty">
                  <p>
                    Nenhum item de orçamento foi carregado ainda. Faça o upload de um PDF ou adicione
                    itens manualmente.
                  </p>
                  <button type="button" className="ghost" onClick={handleAddBudgetItem}>
                    Adicionar item manualmente
                  </button>
                </div>
              ) : (
                <>
                  <div className="table-wrapper budget-table-wrapper">
                    <table className="budget-table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Descrição</th>
                          <th>Quantidade</th>
                          <th>Valor unitário</th>
                          <th>Total do item</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kitBudget.items.map((item) => {
                          const lineTotal = computeBudgetItemLineTotal(item)
                          return (
                            <tr key={item.id}>
                              <td>
                                <input
                                  type="text"
                                  value={item.productName}
                                  onChange={(event) =>
                                    handleBudgetItemTextChange(item.id, 'productName', event.target.value)
                                  }
                                  placeholder="Nome do produto"
                                />
                              </td>
                              <td>
                                <textarea
                                  value={item.description}
                                  onChange={(event) =>
                                    handleBudgetItemTextChange(item.id, 'description', event.target.value)
                                  }
                                  placeholder="Descrição ou observações"
                                  rows={3}
                                />
                              </td>
                              <td className="budget-table-numeric">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.quantityInput}
                                  onChange={(event) =>
                                    handleBudgetItemQuantityChange(item.id, event.target.value)
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="budget-table-numeric">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.unitPriceInput}
                                  onChange={(event) =>
                                    handleBudgetItemUnitPriceChange(item.id, event.target.value)
                                  }
                                  placeholder="0,00"
                                />
                              </td>
                              <td className="budget-table-total">
                                {lineTotal !== null ? currency(lineTotal) : '—'}
                              </td>
                              <td className="budget-table-actions">
                                <button
                                  type="button"
                                  className="link danger"
                                  onClick={() => handleRemoveBudgetItem(item.id)}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="budget-actions">
                    <button type="button" className="ghost" onClick={handleAddBudgetItem}>
                      Adicionar item
                    </button>
                  </div>
                </>
              )}
              <div className="budget-summary">
                <div className="budget-total-field">
                  <label htmlFor="budget-total-input">Valor Total do Orçamento</label>
                  <input
                    id="budget-total-input"
                    type="text"
                    inputMode="decimal"
                    value={kitBudget.totalInput}
                    onChange={(event) => handleBudgetTotalChange(event.target.value)}
                    placeholder="Ex.: 45.000,00"
                  />
                  {kitBudget.totalSource === 'calculated' ? (
                    <small className="muted">
                      Valor calculado automaticamente com base nos itens listados.
                    </small>
                  ) : kitBudget.totalSource === 'explicit' ? (
                    <small className="muted">Valor identificado no PDF. Ajuste se necessário.</small>
                  ) : (
                    <small className="muted">
                      Informe o valor total do orçamento para registrar no sistema.
                    </small>
                  )}
                </div>
                <div className="budget-summary-row">
                  <span>Somatório dos itens:</span>
                  <strong>{budgetItemsTotal !== null ? currency(budgetItemsTotal) : '—'}</strong>
                  {kitBudget.total !== null &&
                  budgetItemsTotal !== null &&
                  Math.abs(kitBudget.total - budgetItemsTotal) > 1 ? (
                    <span className="difference">
                      Diferença de {currency(Math.abs(kitBudget.total - budgetItemsTotal))}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
            {renderCondicoesPagamentoSection()}
            {renderRetornoProjetadoSection()}
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
                  <p>Localize propostas salvas pelo cliente, ID do cliente, CPF, unidade consumidora ou código do orçamento.</p>
                </div>
                <Field
                  label="Buscar orçamentos"
                  hint="Procure pelo cliente, ID do cliente, CPF, unidade consumidora ou código do orçamento."
                >
                  <input
                    id="budget-search-input"
                    type="search"
                    value={orcamentoSearchTerm}
                    onChange={(e) => setOrcamentoSearchTerm(e.target.value)}
                    placeholder="Ex.: ABC12, 123.456.789-00 ou SLRINVST-00001234"
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

        </div>
      )}
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
    </>
  )
}

