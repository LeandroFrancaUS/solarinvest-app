// server/projects/planMapper.js
// Plain JS mirror of src/domain/projects/mapPlanToProject.ts used by the
// server runtime (no TS build step for server code). Keep these two files
// in lock-step: any change here must also land in the TS version.

export const PROJECT_TYPES = Object.freeze(['leasing', 'venda'])
export const PROJECT_STATUSES = Object.freeze(['Aguardando', 'Em andamento', 'Concluído'])

export function mapContractTypeToProjectType(contractType) {
  if (contractType == null) return null
  const normalized = String(contractType).trim().toLowerCase()
  if (normalized === 'leasing') return 'leasing'
  if (normalized === 'venda' || normalized === 'sale' || normalized === 'buyout') return 'venda'
  return null
}

export function isProjectType(value) {
  return typeof value === 'string' && PROJECT_TYPES.includes(value)
}

export function isProjectStatus(value) {
  return typeof value === 'string' && PROJECT_STATUSES.includes(value)
}

export function validatePlanSnapshot(snapshot) {
  const errors = []
  if (!snapshot?.client_id || !Number.isFinite(Number(snapshot.client_id))) {
    errors.push({
      code: 'MISSING_CLIENT_ID',
      message: 'Plano sem cliente vinculado — não é possível criar projeto.',
    })
  }
  if (!snapshot?.plan_id || !String(snapshot.plan_id).trim()) {
    errors.push({
      code: 'MISSING_PLAN_ID',
      message: 'Plano sem identificador — não é possível criar projeto.',
    })
  }
  if (mapContractTypeToProjectType(snapshot?.contract_type ?? null) === null) {
    errors.push({
      code: 'INVALID_CONTRACT_TYPE',
      message:
        'Tipo do plano inválido. Esperado: "leasing" ou "venda" (aceita também "sale"/"buyout").',
    })
  }
  return errors
}

export function buildNewProjectFields(snapshot, initialStatus = 'Aguardando') {
  const errors = validatePlanSnapshot(snapshot)
  if (errors.length > 0) {
    const err = new Error(errors.map((e) => e.message).join(' | '))
    err.validationErrors = errors
    err.code = 'INVALID_PLAN'
    throw err
  }

  if (!isProjectStatus(initialStatus)) {
    throw new Error(`Status inicial inválido: ${initialStatus}`)
  }

  const projectType = mapContractTypeToProjectType(snapshot.contract_type)

  const textOrNull = (v) => {
    if (v == null) return null
    const t = String(v).trim()
    return t.length ? t : null
  }

  return {
    client_id: Number(snapshot.client_id),
    plan_id: String(snapshot.plan_id).trim(),
    contract_id: snapshot.contract_id == null ? null : Number(snapshot.contract_id),
    proposal_id: snapshot.proposal_id ?? null,
    project_type: projectType,
    status: initialStatus,
    client_name_snapshot: textOrNull(snapshot.client_name),
    cpf_cnpj_snapshot: textOrNull(snapshot.cpf_cnpj),
    city_snapshot: textOrNull(snapshot.city),
    state_snapshot: textOrNull(snapshot.state),
  }
}

export function buildPlanIdFromContract(contractId) {
  return `contract:${contractId}`
}

/**
 * Canonical RFC-4122 UUID shape — used to validate proposal_id before we
 * cast it to the uuid type at the DB layer.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

