import { TipoRede } from '../../shared/rede'
import {
  evaluateNormCompliance,
  normalizeTipoLigacaoNorma,
  NormComplianceResult,
} from './padraoEntradaRules'

export type PrecheckNormativoStatus = 'OK' | 'AJUSTE_NECESSARIO' | 'IMPEDIMENTO' | 'INDETERMINADO'

export type PrecheckNormativoInput = {
  uf?: string | null
  tipoRede?: TipoRede | null
  potenciaKw?: number | null
}

export type PrecheckNormativoResult = {
  status: PrecheckNormativoStatus
  observacoes: string[]
  limites: {
    potenciaMaxKw?: number | null
    upgradeTo?: NormComplianceResult['upgradeTo']
    potenciaMaxUpgradeKw?: number | null
  }
  acoesSugeridas: {
    podeAjustarAutomatico: boolean
    potenciaSugeridaKw?: number | null
    tipoLigacaoSugerida?: NormComplianceResult['upgradeTo']
  }
  compliance: NormComplianceResult | null
}

export function calcularPrecheckNormativo(input: PrecheckNormativoInput): PrecheckNormativoResult {
  const uf = (input.uf ?? '').trim().toUpperCase()
  const tipoLigacao = input.tipoRede ? normalizeTipoLigacaoNorma(input.tipoRede) : null
  const potencia =
    typeof input.potenciaKw === 'number' && Number.isFinite(input.potenciaKw)
      ? input.potenciaKw
      : null

  const observacoes: string[] = []
  if (!uf) {
    observacoes.push('Informe a UF para validação normativa.')
  }
  if (!tipoLigacao) {
    observacoes.push('Selecione o tipo de rede para validar o padrão.')
  }
  if (potencia == null || potencia <= 0) {
    observacoes.push('Informe a potência do sistema/inversor.')
  }
  if (!uf || !tipoLigacao || potencia == null || potencia <= 0) {
    return {
      status: 'INDETERMINADO',
      observacoes,
      limites: {},
      acoesSugeridas: { podeAjustarAutomatico: false },
      compliance: null,
    }
  }

  const compliance = evaluateNormCompliance({
    uf,
    tipoLigacao,
    potenciaInversorKw: potencia,
  })

  const limites = {
    potenciaMaxKw: compliance.kwMaxPermitido ?? null,
    upgradeTo: compliance.upgradeTo,
    potenciaMaxUpgradeKw: compliance.kwMaxUpgrade ?? null,
  }

  let status: PrecheckNormativoStatus = 'OK'
  if (compliance.status === 'FORA_DA_NORMA') {
    status = 'AJUSTE_NECESSARIO'
  }
  if (compliance.status === 'LIMITADO') {
    status = 'IMPEDIMENTO'
  }
  if (compliance.status === 'WARNING') {
    status = 'INDETERMINADO'
  }

  const podeAjustarAutomatico =
    compliance.status === 'FORA_DA_NORMA' || compliance.status === 'LIMITADO'
      ? compliance.kwMaxPermitido != null || compliance.kwMaxUpgrade != null
      : false

  if (compliance.status === 'OK') {
    observacoes.push('Dentro do limite do padrão informado.')
  }
  if (compliance.status === 'WARNING') {
    observacoes.push('Regra provisória: valide com a distribuidora antes do envio.')
  }
  if (compliance.status === 'FORA_DA_NORMA') {
    observacoes.push('A potência informada está acima do limite do padrão atual.')
  }
  if (compliance.status === 'LIMITADO') {
    observacoes.push('A potência informada excede o limite mesmo com upgrade.')
  }

  return {
    status,
    observacoes,
    limites,
    acoesSugeridas: {
      podeAjustarAutomatico,
      potenciaSugeridaKw: compliance.kwMaxUpgrade ?? compliance.kwMaxPermitido ?? null,
      tipoLigacaoSugerida: compliance.upgradeTo,
    },
    compliance,
  }
}
