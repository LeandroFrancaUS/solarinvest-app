/**
 * src/lib/imports/buildImportPreview.ts
 *
 * Builds a rich preview model from a NormalizedImportPayload, annotating each
 * row with status (new / duplicate / invalid / update) and selection state.
 */

import type { NormalizedImportRow, NormalizedImportPayload } from './normalizeImportRows'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ImportRowStatus = 'new' | 'duplicate' | 'invalid' | 'update'

export type ImportPreviewRow = {
  key: string
  rowIndex: number
  selected: boolean
  selectable: boolean
  status: ImportRowStatus
  errors: string[]
  warnings: string[]
  data: NormalizedImportRow
}

export type ImportPreviewModel = {
  fileName: string
  sourceType: 'json' | 'csv' | 'xlsx' | 'xls'
  sheetName?: string
  totalRaw: number
  clients: ImportPreviewRow[]
  proposals: ImportPreviewRow[]
  warnings: string[]
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildImportPreview(
  payload: NormalizedImportPayload,
  opts: {
    existingClientNames?: Set<string>
    existingProposalIds?: Set<string>
    sourceType: 'json' | 'csv' | 'xlsx' | 'xls'
    sheetName?: string
  },
): ImportPreviewModel {
  const { existingClientNames, existingProposalIds, sourceType, sheetName } = opts

  const clientRows: ImportPreviewRow[] = payload.clients.map((row) => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!row.nome) {
      errors.push('Nome obrigatório')
      return {
        key: `client-${row.rowIndex}`,
        rowIndex: row.rowIndex,
        selected: false,
        selectable: false,
        status: 'invalid',
        errors,
        warnings,
        data: row,
      }
    }

    const nameLower = row.nome.trim().toLowerCase()
    const isDuplicate =
      existingClientNames != null &&
      [...existingClientNames].some((n) => n.trim().toLowerCase() === nameLower)

    if (isDuplicate) {
      warnings.push('Já existe um cliente com este nome')
      return {
        key: `client-${row.rowIndex}`,
        rowIndex: row.rowIndex,
        selected: false,
        selectable: true,
        status: 'duplicate',
        errors,
        warnings,
        data: row,
      }
    }

    return {
      key: `client-${row.rowIndex}`,
      rowIndex: row.rowIndex,
      selected: true,
      selectable: true,
      status: 'new',
      errors,
      warnings,
      data: row,
    }
  })

  const proposalRows: ImportPreviewRow[] = payload.proposals.map((row) => {
    const errors: string[] = []
    const warnings: string[] = []
    const rawId = String(row.raw['id'] ?? '').trim()

    if (!rawId) {
      return {
        key: `proposal-${row.rowIndex}`,
        rowIndex: row.rowIndex,
        selected: true,
        selectable: true,
        status: 'new',
        errors,
        warnings,
        data: row,
      }
    }

    const isDuplicate =
      existingProposalIds != null && existingProposalIds.has(rawId)

    if (isDuplicate) {
      warnings.push('Proposta com este ID já existe')
      return {
        key: `proposal-${row.rowIndex}`,
        rowIndex: row.rowIndex,
        selected: false,
        selectable: true,
        status: 'duplicate',
        errors,
        warnings,
        data: row,
      }
    }

    return {
      key: `proposal-${row.rowIndex}`,
      rowIndex: row.rowIndex,
      selected: true,
      selectable: true,
      status: 'new',
      errors,
      warnings,
      data: row,
    }
  })

  const totalRaw = payload.clients.length + payload.proposals.length + payload.unknown.length

  return {
    fileName: payload.sourceFileName,
    sourceType,
    ...(sheetName !== undefined && { sheetName }),
    totalRaw,
    clients: clientRows,
    proposals: proposalRows,
    warnings: payload.warnings,
  }
}
