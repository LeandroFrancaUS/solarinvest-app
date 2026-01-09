import { getLeasingSnapshot as getLeasingStoreSnapshot } from '../../store/useLeasingStore'
import { getVendaSnapshot } from '../../store/useVendaStore'

export type LeasingSnapshot = {
  tipoPessoa: 'PF' | 'PJ'
  relacaoImovel: 'Proprietário' | 'Inquilino' | 'Comodatário' | 'Outro'
  isCondominio: boolean
  precisaAutorizacaoProprietario: boolean
  condominioTipo?: 'Vertical' | 'Horizontal'
  nomeSindico?: string
  cnpjCondominio?: string
  distribuidora?: string
  ucGeradoraNumero?: string
  enderecoContratante?: string
  enderecoInstalacaoUcGeradora?: string
  cidade?: string
  uf?: string
  tipoEdificacao?: string
  tipoInstalacao?: 'Telhado' | 'Solo' | 'Laje' | 'Outro'
  exigeART_RRT?: boolean
  riscoEstruturalOuDispensa?: boolean
  mensalidade?: number
  prazo?: number
  indiceReajuste?: string
  proprietarios?: Array<{ nome: string; cpfCnpj: string }>
}

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const normalizeDigits = (value: unknown): string =>
  normalizeText(value).replace(/\D/g, '')

const resolveTipoPessoa = (documento: string): 'PF' | 'PJ' => {
  const digits = normalizeDigits(documento)
  return digits.length > 11 ? 'PJ' : 'PF'
}

const hasOwnerInfo = (proprietarios: Array<{ nome: string; cpfCnpj: string }>): boolean =>
  proprietarios.some((item) => normalizeText(item.nome) || normalizeDigits(item.cpfCnpj))

const resolveRelacaoImovel = (
  proprietarios: Array<{ nome: string; cpfCnpj: string }>,
): LeasingSnapshot['relacaoImovel'] => (hasOwnerInfo(proprietarios) ? 'Inquilino' : 'Proprietário')

const resolveCondominioTipo = (segmento: string): LeasingSnapshot['condominioTipo'] => {
  if (segmento === 'cond_vertical') {
    return 'Vertical'
  }
  if (segmento === 'cond_horizontal') {
    return 'Horizontal'
  }
  return undefined
}

const resolveTipoInstalacao = (tipoInstalacao: string): LeasingSnapshot['tipoInstalacao'] => {
  const normalized = normalizeText(tipoInstalacao).toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (normalized.includes('solo')) {
    return 'Solo'
  }
  if (normalized.includes('laje')) {
    return 'Laje'
  }
  if (normalized.includes('telhado')) {
    return 'Telhado'
  }
  if (normalized.includes('fibrocimento')) {
    return 'Telhado'
  }
  return 'Outro'
}

const resolveMensalidade = (mensalidades: Array<{ mensalidade: number }>): number | undefined => {
  if (mensalidades.length === 0) {
    return undefined
  }
  const valor = mensalidades[0]?.mensalidade
  if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
    return undefined
  }
  return valor
}

export const getLeasingSnapshot = (): LeasingSnapshot => {
  const leasingSnapshot = getLeasingStoreSnapshot()
  const vendaSnapshot = getVendaSnapshot()

  const cliente = vendaSnapshot.cliente
  const configuracao = vendaSnapshot.configuracao
  const parametros = vendaSnapshot.parametros
  const contrato = leasingSnapshot.contrato

  const segmento = normalizeText(configuracao.segmento)
  const isCondominio = contrato.tipoContrato === 'condominio' || segmento.startsWith('cond_')
  const condominioTipo = resolveCondominioTipo(segmento)

  const proprietarios = contrato.proprietarios ?? []
  const relacaoImovel = resolveRelacaoImovel(proprietarios)

  const indiceReajuste = Number.isFinite(leasingSnapshot.inflacaoEnergiaAa)
    ? leasingSnapshot.inflacaoEnergiaAa > 0
      ? `${leasingSnapshot.inflacaoEnergiaAa}% a.a.`
      : ''
    : ''

  const enderecoContratante = normalizeText(cliente.endereco)
  const enderecoInstalacaoUcGeradora =
    normalizeText(contrato.localEntrega) || enderecoContratante

  const snapshot: LeasingSnapshot = {
    tipoPessoa: resolveTipoPessoa(cliente.documento),
    relacaoImovel,
    isCondominio,
    precisaAutorizacaoProprietario: relacaoImovel !== 'Proprietário',
    condominioTipo,
    nomeSindico: normalizeText(contrato.nomeSindico) || undefined,
    cnpjCondominio: normalizeText(contrato.cnpjCondominio) || undefined,
    distribuidora: normalizeText(cliente.distribuidora || parametros.distribuidora) || undefined,
    ucGeradoraNumero: normalizeText(cliente.uc) || undefined,
    enderecoContratante: enderecoContratante || undefined,
    enderecoInstalacaoUcGeradora: enderecoInstalacaoUcGeradora || undefined,
    cidade: normalizeText(cliente.cidade) || undefined,
    uf: normalizeText(cliente.uf) || undefined,
    tipoEdificacao: segmento || undefined,
    tipoInstalacao: resolveTipoInstalacao(configuracao.tipo_instalacao),
    exigeART_RRT: false,
    riscoEstruturalOuDispensa: false,
    mensalidade: resolveMensalidade(leasingSnapshot.projecao.mensalidadesAno),
    prazo: Number.isFinite(leasingSnapshot.prazoContratualMeses)
      ? Math.max(0, leasingSnapshot.prazoContratualMeses)
      : undefined,
    indiceReajuste: indiceReajuste || undefined,
    proprietarios,
  }

  return snapshot
}
