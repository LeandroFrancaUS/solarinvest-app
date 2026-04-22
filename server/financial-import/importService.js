// server/financial-import/importService.js
// Core orchestration for the financial import feature.
//
// Two modes:
//   preview  — analyse and enrich items, create batch record (status='previewed'), NO entity creation
//   confirm  — re-run enrichment and CREATE clients/proposals/projects/entries
//
// The caller must provide a db-scoped sql client and the actor userId.

import crypto from 'node:crypto'
import { parseXlsx } from './xlsxParser.js'
import { canonicalizeSheet } from './canonicalizer.js'
import { enrichItem } from './matcher.js'
import {
  insertClient,
  insertProposal,
  insertFinancialProject,
  upsertPowerPlant,
  upsertFinancialSummary,
  insertImportBatch,
  updateImportBatch,
  insertImportItem,
} from './repository.js'

// Minimum client match confidence required to auto-link without manual review.
const AUTO_LINK_MIN_CONFIDENCE = 0.75

/**
 * Parse an XLSX buffer and run enrichment (matching).
 * Does NOT persist any entity changes — only creates a batch record.
 *
 * @param {object} sql - Neon sql client (already scoped to the actor)
 * @param {Buffer} buffer - Raw XLSX file bytes
 * @param {object} opts
 * @param {string} opts.fileName
 * @param {string|null} opts.userId
 * @param {boolean} [opts.mergeMode=false]
 * @returns {Promise<{ batchId, items, summary }>}
 */
export async function previewImport(sql, buffer, { fileName, userId, mergeMode = false }) {
  // Create audit batch record immediately
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const batch = await insertImportBatch(sql, {
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSizeBytes: buffer.length,
    fileHash,
    importType: 'financial_management',
    previewOnly: true,
    mergeMode,
    userId,
  })

  const batchId = batch.id

  // Parse XLSX
  const { sheets } = await parseXlsx(buffer)
  const allItems = []
  const warnings = []

  for (const sheet of sheets) {
    const { type, items } = canonicalizeSheet(sheet.name, sheet.rows)
    if (type === 'unknown') {
      warnings.push(`Aba "${sheet.name}": tipo de planilha não reconhecido, ignorada.`)
      continue
    }

    // Only enrich project-level items (not individual cost entries)
    if (type === 'sale_project' || type === 'leasing_project') {
      for (const item of items) {
        const enriched = await enrichItem(sql, item)
        allItems.push({
          sheetName: sheet.name,
          worksheetType: type,
          ...enriched,
        })
      }
    } else {
      // fixed_costs / variable_costs — no matching needed, just list them
      for (const item of items) {
        allItems.push({
          sheetName: sheet.name,
          worksheetType: type,
          ...item,
          match: null,
        })
      }
    }
  }

  // Build preview summary
  const summary = buildSummary(allItems)

  // Update batch as previewed
  await updateImportBatch(sql, batchId, {
    status: 'previewed',
    total_worksheets: sheets.length,
    total_detected_items: allItems.length,
    warnings,
    summary,
  })

  return { batchId, items: allItems, summary, warnings }
}

/**
 * Confirm and persist an import.
 * Processes each item:
 *   - if no client match (or confidence < threshold) → create new client
 *   - if no proposal match → create new proposal
 *   - if no financial_project match → create new financial_project
 *   - upsert power_plant and financial_summary
 *   - for cost sheets → create financial_entries (future: wire to existing entries table)
 *
 * @param {object} sql
 * @param {Buffer} buffer - Original XLSX bytes (re-parsed to ensure consistency)
 * @param {object} opts
 * @param {string} opts.fileName
 * @param {string|null} opts.userId
 * @param {boolean} [opts.mergeMode=false]
 * @param {string[]} [opts.selectedSheets] - If provided, only process these sheet names
 * @returns {Promise<{ batchId, report }>}
 */
export async function confirmImport(sql, buffer, { fileName, userId, mergeMode = false, selectedSheets }) {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const batch = await insertImportBatch(sql, {
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSizeBytes: buffer.length,
    fileHash,
    importType: 'financial_management',
    previewOnly: false,
    mergeMode,
    userId,
  })

  const batchId = batch.id

  const counters = {
    total_worksheets: 0,
    total_detected_items: 0,
    total_created_clients: 0,
    total_updated_clients: 0,
    total_created_proposals: 0,
    total_updated_proposals: 0,
    total_created_projects: 0,
    total_updated_projects: 0,
    total_created_entries: 0,
    total_ignored_items: 0,
    total_conflicts: 0,
  }
  const warnings = []
  const report = []

  const { sheets } = await parseXlsx(buffer)
  counters.total_worksheets = sheets.length

  for (const sheet of sheets) {
    if (selectedSheets?.length && !selectedSheets.includes(sheet.name)) continue

    const { type, items } = canonicalizeSheet(sheet.name, sheet.rows)
    if (type === 'unknown') {
      warnings.push(`Aba "${sheet.name}": tipo não reconhecido, ignorada.`)
      continue
    }

    counters.total_detected_items += items.length

    if (type === 'fixed_costs' || type === 'variable_costs') {
      // Cost entries — persist to financial_entries if scope is company
      for (const item of items) {
        await insertImportItem(sql, batchId, {
          source_sheet_name: sheet.name,
          worksheet_type: type,
          source_row_start: item.sourceRowIndex,
          source_row_end: item.sourceRowIndex,
          status: 'created',
          raw_json: { row: item.rawRow },
          normalized_json: item.entry,
        })
        counters.total_created_entries++
      }
      report.push({ sheet: sheet.name, type, count: items.length })
      continue
    }

    // sale_project or leasing_project
    for (const item of items) {
      const enriched = await enrichItem(sql, item)
      const m = enriched.match

      let clientId = m.clientId
      let proposalId = m.proposalId
      let projectId = m.projectId
      let clientStatus = 'matched'
      let proposalStatus = 'matched'
      let projectStatus = 'matched'

      // ── Client ──────────────────────────────────────────────────────────────
      if (!clientId || m.clientConfidence < AUTO_LINK_MIN_CONFIDENCE) {
        // Create new client
        const newClient = await insertClient(sql, {
          name: item.clientName,
          state: item.uf,
          userId,
        })
        clientId = Number(newClient.id)
        clientStatus = 'created'
        counters.total_created_clients++
      }

      // ── Proposal ─────────────────────────────────────────────────────────────
      if (!proposalId) {
        const proposalType = type === 'sale_project' ? 'venda' : 'leasing'
        const newProposal = await insertProposal(sql, {
          clientId,
          proposalType,
          clientName: item.clientName,
          state: item.uf,
          userId,
          payload: {
            usina: item.usina,
            financeiro: item.financeiro,
            importSource: 'excel',
          },
        })
        proposalId = newProposal.id
        proposalStatus = 'created'
        counters.total_created_proposals++
      }

      // ── Financial project ─────────────────────────────────────────────────
      if (!projectId) {
        const projectType = type === 'sale_project' ? 'sale' : 'leasing'
        const newProject = await insertFinancialProject(sql, {
          clientId,
          proposalId,
          projectType,
          title: item.clientName,
          state: item.uf,
          batchId,
          userId,
        })
        projectId = newProject.id
        projectStatus = 'created'
        counters.total_created_projects++
      }

      // ── Usina (power plant) ───────────────────────────────────────────────
      if (item.usina && Object.values(item.usina).some((v) => v != null)) {
        await upsertPowerPlant(sql, projectId, clientId, proposalId, item.usina)
      }

      // ── Financial summary ─────────────────────────────────────────────────
      if (item.financeiro && Object.values(item.financeiro).some((v) => v != null)) {
        await upsertFinancialSummary(sql, projectId, clientId, proposalId, item.financeiro)
      }

      // ── Import item record ────────────────────────────────────────────────
      await insertImportItem(sql, batchId, {
        source_sheet_name: sheet.name,
        worksheet_type: type,
        source_row_start: item.sourceRowIndex,
        source_row_end: item.sourceRowIndex,
        detected_client_name: item.clientName,
        detected_uf: item.uf,
        detected_project_type: type === 'sale_project' ? 'sale' : 'leasing',
        match_type: m.clientMatchType ?? 'none',
        match_confidence: m.clientConfidence ?? 0,
        linked_client_id: m.clientId ?? null,
        linked_proposal_id: m.proposalId ?? null,
        linked_project_id: m.projectId ?? null,
        created_client_id: clientStatus === 'created' ? clientId : null,
        created_proposal_id: proposalStatus === 'created' ? proposalId : null,
        created_project_id: projectStatus === 'created' ? projectId : null,
        status: 'created',
        raw_json: { row: item.rawRow },
        normalized_json: { clientName: item.clientName, uf: item.uf, usina: item.usina, financeiro: item.financeiro },
      })

      report.push({
        sheet: sheet.name,
        clientName: item.clientName,
        uf: item.uf,
        client: { id: clientId, status: clientStatus },
        proposal: { id: proposalId, status: proposalStatus },
        project: { id: projectId, status: projectStatus },
      })
    }
  }

  // Update batch counters
  await updateImportBatch(sql, batchId, {
    status: warnings.length > 0 ? 'completed_with_warnings' : 'completed',
    ...counters,
    warnings,
    summary: { report_rows: report.length },
  })

  return { batchId, report, counters, warnings }
}

// ────────────────────────────────────────────────────────────────────────────

function buildSummary(items) {
  const projectItems = items.filter((i) => i.worksheetType === 'sale_project' || i.worksheetType === 'leasing_project')
  const totalNew = projectItems.filter((i) => !i.match?.clientId).length
  const totalMatched = projectItems.filter((i) => i.match?.clientId).length
  const totalConflict = projectItems.filter(
    (i) => i.match?.clientId && i.match.clientConfidence < AUTO_LINK_MIN_CONFIDENCE,
  ).length

  return {
    total_items: items.length,
    total_project_items: projectItems.length,
    total_new_clients: totalNew,
    total_matched_clients: totalMatched,
    total_conflicts: totalConflict,
    auto_link_threshold: AUTO_LINK_MIN_CONFIDENCE,
  }
}
