import { ANNEX_IDS, type LeasingAnnexId } from './annexIds'
import type { LeasingSnapshot } from './getLeasingSnapshot'

export type AnnexDecision = {
  id: string
  selected: boolean
  locked: boolean
  visible: boolean
  reason?: string
  missing?: Array<{
    label: string
    fieldPath?: string
  }>
}

export type AnnexAutoSelectResult = {
  decisions: Record<string, AnnexDecision>
  requiredMissing: Array<{
    id: string
    title: string
    missing: AnnexDecision['missing']
  }>
}

const ANNEX_TITLES: Record<LeasingAnnexId, string> = {
  [ANNEX_IDS.DADOS_TECNICOS_USINA]: 'Dados técnicos da usina',
  [ANNEX_IDS.PLANO_PAGAMENTO]: 'Plano de pagamento',
  [ANNEX_IDS.MAPA_UC_ENDERECOS]: 'Mapa de UC e endereços',
  [ANNEX_IDS.CHECKLIST_PF]: 'Checklist PF',
  [ANNEX_IDS.CHECKLIST_PJ]: 'Checklist PJ',
  [ANNEX_IDS.CHECKLIST_CONDOMINIO]: 'Checklist condomínio',
  [ANNEX_IDS.AUT_PROPRIETARIO]: 'Autorização do proprietário',
  [ANNEX_IDS.ATA_CONDOMINIO]: 'Ata de condomínio',
  [ANNEX_IDS.ART_RRT]: 'ART/RRT',
  [ANNEX_IDS.TERMO_ESTRUTURAL]: 'Termo estrutural',
  [ANNEX_IDS.OEM_GARANTIAS]: 'OEM e garantias',
}

const createDecision = (id: LeasingAnnexId): AnnexDecision => ({
  id,
  selected: false,
  locked: false,
  visible: false,
})

const markOptional = (decision: AnnexDecision) => ({
  ...decision,
  visible: true,
  selected: false,
  locked: false,
})

const markRequired = (decision: AnnexDecision, missing?: AnnexDecision['missing']) => ({
  ...decision,
  visible: true,
  selected: true,
  locked: true,
  missing: missing && missing.length > 0 ? missing : undefined,
})

const withLabel = (label: string, fieldPath?: string) => ({ label, fieldPath })

const missingText = (value?: string): boolean => !value || value.trim().length === 0

const missingNumber = (value?: number): boolean =>
  !Number.isFinite(value) || (value ?? 0) <= 0

const getMissingDadosTecnicosUsina = (snapshot: LeasingSnapshot) => {
  const missing: AnnexDecision['missing'] = []
  if (missingText(snapshot.distribuidora)) {
    missing.push(withLabel('Distribuidora', '[data-field="cliente-distribuidoraAneel"]'))
  }
  if (missingText(snapshot.ucGeradoraNumero)) {
    missing.push(withLabel('Número da UC geradora', '[data-field="cliente-ucGeradoraNumero"]'))
  }
  if (missingText(snapshot.enderecoInstalacaoUcGeradora)) {
    missing.push(
      withLabel(
        'Endereço de instalação da UC geradora',
        '[data-field="cliente-enderecoInstalacaoUcGeradora"]',
      ),
    )
  }
  if (missingText(snapshot.cidade)) {
    missing.push(withLabel('Cidade', '[data-field="cliente-cidade"]'))
  }
  if (missingText(snapshot.uf)) {
    missing.push(withLabel('UF', '[data-field="cliente-uf"]'))
  }
  if (missingText(snapshot.tipoEdificacao)) {
    missing.push(withLabel('Tipo de edificação', '[data-field="cliente-tipoEdificacao"]'))
  }
  return missing
}

const getMissingMapaUc = (snapshot: LeasingSnapshot) => {
  const missing: AnnexDecision['missing'] = []
  if (missingText(snapshot.enderecoContratante)) {
    missing.push(withLabel('Endereço do contratante', '[data-field="cliente-enderecoContratante"]'))
  }
  if (missingText(snapshot.enderecoInstalacaoUcGeradora)) {
    missing.push(
      withLabel(
        'Endereço de instalação da UC geradora',
        '[data-field="cliente-enderecoInstalacaoUcGeradora"]',
      ),
    )
  }
  if (missingText(snapshot.cidade)) {
    missing.push(withLabel('Cidade', '[data-field="cliente-cidade"]'))
  }
  if (missingText(snapshot.uf)) {
    missing.push(withLabel('UF', '[data-field="cliente-uf"]'))
  }
  return missing
}

const getMissingAutorizacaoProprietario = (snapshot: LeasingSnapshot) => {
  const missing: AnnexDecision['missing'] = []
  const proprietario = snapshot.proprietarios?.[0]
  if (missingText(proprietario?.nome)) {
    missing.push(withLabel('Nome do proprietário', '[data-field="leasing-proprietario-nome-0"]'))
  }
  if (missingText(proprietario?.cpfCnpj)) {
    missing.push(
      withLabel('CPF/CNPJ do proprietário', '[data-field="leasing-proprietario-cpf-0"]'),
    )
  }
  return missing
}

const getMissingAtaCondominio = (snapshot: LeasingSnapshot) => {
  const missing: AnnexDecision['missing'] = []
  if (missingText(snapshot.cnpjCondominio)) {
    missing.push(withLabel('CNPJ do condomínio', '[data-field="leasing-cnpj-condominio"]'))
  }
  if (missingText(snapshot.nomeSindico)) {
    missing.push(withLabel('Nome do síndico', '[data-field="leasing-nome-sindico"]'))
  }
  return missing
}

const getMissingPlanoPagamento = (snapshot: LeasingSnapshot) => {
  const missing: AnnexDecision['missing'] = []
  if (missingNumber(snapshot.mensalidade)) {
    missing.push(withLabel('Valor da mensalidade'))
  }
  if (missingNumber(snapshot.prazo)) {
    missing.push(withLabel('Prazo do contrato', '[data-field="leasing-prazo-anos"]'))
  }
  if (missingText(snapshot.indiceReajuste)) {
    missing.push(withLabel('Índice de reajuste'))
  }
  return missing
}

export const autoSelectAnnexes = (snapshot: LeasingSnapshot): AnnexAutoSelectResult => {
  const decisions: Record<string, AnnexDecision> = {}

  const allIds = Object.values(ANNEX_IDS)
  allIds.forEach((id) => {
    decisions[id] = createDecision(id)
  })

  const requiredBase: LeasingAnnexId[] = [
    ANNEX_IDS.DADOS_TECNICOS_USINA,
    ANNEX_IDS.PLANO_PAGAMENTO,
    ANNEX_IDS.MAPA_UC_ENDERECOS,
    ANNEX_IDS.OEM_GARANTIAS,
  ]

  requiredBase.forEach((id) => {
    const missing =
      id === ANNEX_IDS.DADOS_TECNICOS_USINA
        ? getMissingDadosTecnicosUsina(snapshot)
        : id === ANNEX_IDS.MAPA_UC_ENDERECOS
          ? getMissingMapaUc(snapshot)
          : id === ANNEX_IDS.PLANO_PAGAMENTO
            ? getMissingPlanoPagamento(snapshot)
            : undefined
    decisions[id] = markRequired(decisions[id], missing)
  })

  if (snapshot.isCondominio) {
    decisions[ANNEX_IDS.CHECKLIST_CONDOMINIO] = markRequired(decisions[ANNEX_IDS.CHECKLIST_CONDOMINIO])
  } else if (snapshot.tipoPessoa === 'PF') {
    decisions[ANNEX_IDS.CHECKLIST_PF] = markRequired(decisions[ANNEX_IDS.CHECKLIST_PF])
  } else {
    decisions[ANNEX_IDS.CHECKLIST_PJ] = markRequired(decisions[ANNEX_IDS.CHECKLIST_PJ])
  }

  if (snapshot.precisaAutorizacaoProprietario) {
    const missing = getMissingAutorizacaoProprietario(snapshot)
    decisions[ANNEX_IDS.AUT_PROPRIETARIO] = markRequired(decisions[ANNEX_IDS.AUT_PROPRIETARIO], missing)
  }

  if (snapshot.isCondominio) {
    const missing = getMissingAtaCondominio(snapshot)
    decisions[ANNEX_IDS.ATA_CONDOMINIO] = markRequired(decisions[ANNEX_IDS.ATA_CONDOMINIO], missing)
  }

  if (snapshot.exigeART_RRT) {
    decisions[ANNEX_IDS.ART_RRT] = markRequired(decisions[ANNEX_IDS.ART_RRT])
  } else {
    decisions[ANNEX_IDS.ART_RRT] = markOptional(decisions[ANNEX_IDS.ART_RRT])
  }

  if (snapshot.riscoEstruturalOuDispensa) {
    decisions[ANNEX_IDS.TERMO_ESTRUTURAL] = markRequired(decisions[ANNEX_IDS.TERMO_ESTRUTURAL])
  } else {
    decisions[ANNEX_IDS.TERMO_ESTRUTURAL] = markOptional(decisions[ANNEX_IDS.TERMO_ESTRUTURAL])
  }

  const requiredMissing = Object.values(decisions)
    .filter((decision) => decision.locked && decision.missing && decision.missing.length > 0)
    .map((decision) => ({
      id: decision.id,
      title: ANNEX_TITLES[decision.id as LeasingAnnexId] ?? decision.id,
      missing: decision.missing,
    }))

  return { decisions, requiredMissing }
}
