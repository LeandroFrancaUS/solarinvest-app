// src/services/financialImportApi.ts
// REST client for the /api/financial-import endpoints.

import { resolveApiUrl } from '../utils/apiUrl'

// ── Token provider (injected by App.tsx, same pattern as other API modules) ──

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null

export function setFinancialImportTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenProvider ? await tokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Types ────────────────────────────────────────────────────────────────────

export type WorksheetType =
  | 'sale_project'
  | 'leasing_project'
  | 'fixed_costs'
  | 'variable_costs'
  | 'unknown'

export type ClientMatchType = 'exact' | 'probable' | 'weak' | 'none'

export interface PreviewItemMatch {
  clientId: number | null
  clientName: string | null
  clientConfidence: number
  clientMatchType: ClientMatchType
  proposalId: string | null
  projectId: string | null
}

export interface PreviewItem {
  sheetName: string
  worksheetType: WorksheetType
  sourceRowIndex: number
  clientName: string | null
  uf: string | null
  usina: Record<string, unknown> | null
  financeiro: Record<string, unknown> | null
  entry: Record<string, unknown> | null
  match: PreviewItemMatch | null
}

export interface ImportSummary {
  total_items: number
  total_project_items: number
  total_new_clients: number
  total_matched_clients: number
  total_conflicts: number
  auto_link_threshold: number
}

export interface ParseResult {
  batchId: string
  items: PreviewItem[]
  summary: ImportSummary
  warnings: string[]
}

export interface ConfirmCounters {
  total_created_clients: number
  total_created_proposals: number
  total_created_projects: number
  total_created_entries: number
  total_ignored_items: number
  total_conflicts: number
}

export interface ConfirmReportRow {
  sheet: string
  clientName?: string
  uf?: string
  client?: { id: number; status: string }
  proposal?: { id: string; status: string }
  project?: { id: string; status: string }
  count?: number
  type?: string
}

export interface ConfirmResult {
  batchId: string
  report: ConfirmReportRow[]
  counters: ConfirmCounters
  warnings: string[]
}

export interface ImportBatch {
  id: string
  source_file_name: string
  status: string
  preview_only: boolean
  merge_mode: boolean
  total_detected_items: number
  total_created_clients: number
  total_created_projects: number
  total_conflicts: number
  created_by_user_id: string | null
  created_at: string
  completed_at: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_TIMEOUT_MS = 60_000 // 60 s — file uploads may be slow

async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(await authHeaders()),
  }
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}))
      const msg =
        (body as { error?: { message?: string } })?.error?.message ??
        (typeof (body as { error?: string }).error === 'string'
          ? (body as { error: string }).error
          : `HTTP ${res.status}`)
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildUrl(path: string): string {
  return resolveApiUrl(path)
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Upload an XLSX file for preview (no entities created).
 * Returns canonical items with match metadata.
 */
export async function parseImportFile(
  file: File,
  opts: { mergeMode?: boolean } = {},
): Promise<ParseResult> {
  const url = buildUrl('/api/financial-import/parse')
  const arrayBuffer = await file.arrayBuffer()
  const res = await apiFetch<{ data: ParseResult }>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      'X-Import-Merge-Mode': opts.mergeMode ? 'true' : 'false',
    },
    body: arrayBuffer,
  })
  return res.data
}

/**
 * Upload an XLSX file and run the full import (creates entities).
 */
export async function confirmImportFile(
  file: File,
  opts: { mergeMode?: boolean; selectedSheets?: string[] } = {},
): Promise<ConfirmResult> {
  const url = buildUrl('/api/financial-import/confirm')
  const arrayBuffer = await file.arrayBuffer()
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
    'X-Import-Merge-Mode': opts.mergeMode ? 'true' : 'false',
  }
  if (opts.selectedSheets?.length) {
    headers['X-Import-Sheets'] = opts.selectedSheets.join(',')
  }
  const res = await apiFetch<{ data: ConfirmResult }>(url, {
    method: 'POST',
    headers,
    body: arrayBuffer,
  })
  return res.data
}

/**
 * List recent import batches (audit log).
 */
export async function fetchImportBatches(limit = 20): Promise<ImportBatch[]> {
  const url = buildUrl(`/api/financial-import/batches?limit=${limit}`)
  const res = await apiFetch<{ data: ImportBatch[] }>(url, { method: 'GET' })
  return res.data
}
