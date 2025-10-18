import type { ParsedVendaPdfData } from '../lib/pdf/extractVendas'
import type { RetornoProjetado, VendaForm } from '../lib/finance/roi'
import type { VendaSnapshot } from '../store/useVendaStore'

export type TipoInstalacao = 'TELHADO' | 'SOLO'

export type UfvComposicaoTelhadoValores = {
  projeto: number
  instalacao: number
  materialCa: number
  crea: number
  art: number
  placa: number
  comissaoLiquida: number
  lucroBruto: number
  impostoRetido: number
}

export type UfvComposicaoSoloValores = UfvComposicaoTelhadoValores & {
  estruturaSolo: number
  tela: number
  portaoTela: number
  maoObraTela: number
  casaInversor: number
  brita: number
  terraplanagem: number
  trafo: number
  rede: number
}

export type UfvComposicaoResumo = {
  telhado: UfvComposicaoTelhadoValores
  solo: UfvComposicaoSoloValores
  totalTelhado: number
  totalSolo: number
  valorOrcamento: number
  valorVendaTelhado: number
  valorVendaSolo: number
  tipoAtual: TipoInstalacao
}

export type ClienteDados = {
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

export type MensalidadeRow = {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
  mensalidadeCheia: number
  mensalidade: number
  totalAcumulado: number
}

export type BuyoutRow = {
  mes: number
  tarifa: number
  prestacaoEfetiva: number
  prestacaoAcum: number
  cashback: number
  valorResidual: number | null
}

export type BuyoutResumo = {
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

export type PrintableProposalTipo = 'LEASING' | 'VENDA_DIRETA'

export type PrintableOrcamentoItem = {
  produto: string
  descricao: string
  codigo?: string | undefined
  modelo?: string | undefined
  fabricante?: string | undefined
  quantidade?: number | null
  valorUnitario?: number | null
  valorTotal?: number | null
}

export type PrintableProposalProps = {
  cliente: ClienteDados
  budgetId?: string | undefined
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
  potenciaModulo: number
  numeroModulos: number
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
  } | undefined
  parsedPdfVenda?: ParsedVendaPdfData | null | undefined
  orcamentoItens?: PrintableOrcamentoItem[] | undefined
  composicaoUfv?: UfvComposicaoResumo | undefined
  vendaSnapshot?: VendaSnapshot | undefined
}
