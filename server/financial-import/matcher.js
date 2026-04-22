// server/financial-import/matcher.js
// Intelligent client/proposal/project matching logic.
//
// Matching hierarchy (as specified):
//   1) Exact: same name + same UF (confidence 1.0, matchType 'exact')
//   2) Probable: same name, different/missing UF (confidence 0.75, 'probable')
//   3) Weak: name contains or is contained (confidence 0.4, 'weak')
//   4) None: no match (confidence 0.0, 'none')
//
// Returns the best single match result for a given client name + UF.

import {
  findClientsByName,
  findClientByNameAndState,
  findProposalsByClientId,
  findProposalsByClientName,
  findFinancialProjectsByClientId,
} from './repository.js'

/**
 * Attempt to match an imported client name (+ optional UF) against existing clients.
 *
 * @param {object} sql - Neon/postgres sql client
 * @param {string} clientName
 * @param {string|null} uf
 * @returns {Promise<{
 *   clientId: number|null,
 *   clientName: string|null,
 *   confidence: number,
 *   matchType: 'exact'|'probable'|'weak'|'none'
 * }>}
 */
export async function matchClient(sql, clientName, uf) {
  if (!clientName?.trim()) {
    return { clientId: null, clientName: null, confidence: 0, matchType: 'none' }
  }

  const name = clientName.trim()
  const normalizedUf = uf?.trim().toUpperCase() || null

  // Try exact name + UF match first
  if (normalizedUf) {
    const exact = await findClientByNameAndState(sql, name, normalizedUf)
    if (exact) {
      return {
        clientId: Number(exact.id),
        clientName: exact.name,
        confidence: 1.0,
        matchType: 'exact',
      }
    }
  }

  // Try candidates by partial name match
  const candidates = await findClientsByName(sql, name)
  if (candidates.length === 0) {
    return { clientId: null, clientName: null, confidence: 0, matchType: 'none' }
  }

  const nameLower = name.toLowerCase()
  let bestMatch = null
  let bestScore = 0

  for (const c of candidates) {
    const cNameLower = (c.name ?? '').toLowerCase().trim()
    const cUf = (c.state ?? '').toUpperCase().trim()

    // Exact name (case-insensitive)
    if (cNameLower === nameLower) {
      const ufMatch = normalizedUf && cUf ? cUf === normalizedUf : true
      const score = ufMatch ? 0.9 : 0.75
      if (score > bestScore) {
        bestScore = score
        bestMatch = c
      }
    } else if (cNameLower.includes(nameLower) || nameLower.includes(cNameLower)) {
      // Substring match → weak
      if (0.4 > bestScore) {
        bestScore = 0.4
        bestMatch = c
      }
    }
  }

  if (!bestMatch) {
    return { clientId: null, clientName: null, confidence: 0, matchType: 'none' }
  }

  let matchType
  if (bestScore >= 0.9) matchType = 'exact'
  else if (bestScore >= 0.7) matchType = 'probable'
  else matchType = 'weak'

  return {
    clientId: Number(bestMatch.id),
    clientName: bestMatch.name,
    confidence: bestScore,
    matchType,
  }
}

/**
 * Attempt to match a proposal for a known client.
 * Looks for proposals already linked via client_id, then by client_name snapshot.
 *
 * @param {object} sql
 * @param {number} clientId
 * @param {string} clientName
 * @param {'sale_project'|'leasing_project'|string} worksheetType
 * @returns {Promise<{ proposalId: string|null, confidence: number }>}
 */
export async function matchProposal(sql, clientId, clientName, worksheetType) {
  const proposalType = worksheetType === 'sale_project' ? 'venda' : 'leasing'

  // First look by client_id FK
  const byClientId = await findProposalsByClientId(sql, clientId)
  const typeMatch = byClientId.filter((p) => p.proposal_type === proposalType)
  if (typeMatch.length > 0) {
    return { proposalId: typeMatch[0].id, confidence: 0.9 }
  }
  if (byClientId.length > 0) {
    return { proposalId: byClientId[0].id, confidence: 0.6 }
  }

  // Fall back to client_name snapshot match
  const byName = await findProposalsByClientName(sql, clientName)
  const byNameType = byName.filter((p) => p.proposal_type === proposalType)
  if (byNameType.length > 0) {
    return { proposalId: byNameType[0].id, confidence: 0.6 }
  }
  if (byName.length > 0) {
    return { proposalId: byName[0].id, confidence: 0.4 }
  }

  return { proposalId: null, confidence: 0 }
}

/**
 * Attempt to match an existing financial_project for a known client.
 *
 * @param {object} sql
 * @param {number} clientId
 * @param {'sale_project'|'leasing_project'} worksheetType
 * @returns {Promise<{ projectId: string|null, confidence: number }>}
 */
export async function matchFinancialProject(sql, clientId, worksheetType) {
  const projectType = worksheetType === 'sale_project' ? 'sale' : 'leasing'
  const existing = await findFinancialProjectsByClientId(sql, clientId)
  const typeMatch = existing.filter((p) => p.project_type === projectType)
  if (typeMatch.length > 0) {
    return { projectId: typeMatch[0].id, confidence: 0.85 }
  }
  if (existing.length > 0) {
    return { projectId: existing[0].id, confidence: 0.5 }
  }
  return { projectId: null, confidence: 0 }
}

/**
 * Run full enrichment for a single canonical item.
 * Resolves client → proposal → project matches.
 *
 * @returns enriched item with match metadata attached.
 */
export async function enrichItem(sql, item) {
  const clientMatch = await matchClient(sql, item.clientName, item.uf)

  let proposalMatch = { proposalId: null, confidence: 0 }
  let projectMatch = { projectId: null, confidence: 0 }

  if (clientMatch.clientId) {
    proposalMatch = await matchProposal(sql, clientMatch.clientId, item.clientName, item.worksheetType)
    projectMatch = await matchFinancialProject(sql, clientMatch.clientId, item.worksheetType)
  }

  return {
    ...item,
    match: {
      clientId: clientMatch.clientId,
      clientName: clientMatch.clientName,
      clientConfidence: clientMatch.confidence,
      clientMatchType: clientMatch.matchType,
      proposalId: proposalMatch.proposalId,
      proposalConfidence: proposalMatch.confidence,
      projectId: projectMatch.projectId,
      projectConfidence: projectMatch.confidence,
    },
  }
}
