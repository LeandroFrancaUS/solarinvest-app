import React from 'react'
import { getProposal, listProposals } from '../lib/api/proposalsApi'
import { filterSavedProposals, sortSavedProposals } from '../lib/proposals/proposalSearch'
import { normalizeSavedProposalRecord } from '../lib/proposals/normalizers'
import type { ProposalSearchParams, SavedProposalRecord, SearchSavedProposalsResponse } from '../lib/proposals/types'
import { renderToStaticMarkup } from 'react-dom/server'
import PrintableProposal from '../components/print/PrintableProposal'
import { printStyles } from '../styles/printTheme'
import type { PrintableProposalProps, PrintableProposalTipo } from '../types/printableProposal'

const DEFAULT_LIMIT = 20

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num))
}

export async function searchSavedProposals(params: ProposalSearchParams = {}): Promise<SearchSavedProposalsResponse> {
  const page = params.page ?? 1
  const limit = clamp(params.limit ?? DEFAULT_LIMIT, 1, 100)

  const res = await listProposals({ page, limit })
  const normalized = res.data.map(normalizeSavedProposalRecord)
  const filtered = sortSavedProposals(filterSavedProposals(normalized, params))

  return {
    items: filtered,
    total: res.pagination.total,
    page: res.pagination.page,
    limit: res.pagination.limit,
  }
}

export async function getSavedProposalRecord(recordId: string): Promise<SavedProposalRecord | null> {
  const proposal = await getProposal(recordId)
  if (!proposal) return null
  return normalizeSavedProposalRecord(proposal)
}

export async function findSavedProposalByExactCode(code: string): Promise<SavedProposalRecord | null> {
  const needle = code.trim().toLowerCase()
  if (!needle) return null

  for (let page = 1; page <= 5; page += 1) {
    const res = await listProposals({ page, limit: 100 })
    const match = res.data
      .map(normalizeSavedProposalRecord)
      .find((item) => item.code.trim().toLowerCase() === needle)
    if (match) return match
    if (page >= res.pagination.pages) break
  }

  return null
}

export function getSavedProposalPreviewUrl(record: SavedProposalRecord): string | null {
  return record.previewUrl ?? record.fileUrl ?? null
}

export function getSavedProposalDownloadUrl(record: SavedProposalRecord): string | null {
  return record.fileUrl ?? null
}

export function openSavedProposalPreview(record: SavedProposalRecord): void {
  const url = getSavedProposalPreviewUrl(record)
  if (typeof window === 'undefined') return
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  const payload = record.payload
  if (!payload || typeof payload !== 'object') {
    window.alert('Não foi possível abrir a proposta: arquivo de preview indisponível.')
    return
  }

  const tipoProposta: PrintableProposalTipo = record.proposalType === 'venda' ? 'VENDA_DIRETA' : 'LEASING'
  const dados = {
    ...payload,
    tipoProposta,
  } as unknown as PrintableProposalProps

  const markup = renderToStaticMarkup(React.createElement(PrintableProposal, dados))
  if (!markup) {
    window.alert('Não foi possível montar a pré-visualização da proposta.')
    return
  }

  const previewWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
  if (!previewWindow) {
    window.alert('Não foi possível abrir a janela de pré-visualização. Verifique bloqueador de pop-up.')
    return
  }

  const title = `Proposta ${record.code || 'SolarInvest'}`
  previewWindow.document.write(`<!doctype html>
<html data-print-mode="preview">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${printStyles}</style>
  </head>
  <body data-print-mode="preview">
    <div class="preview-toolbar" style="position:sticky;top:0;z-index:20;background:#ffffff;color:#0f172a;border-bottom:1px solid #e2e8f0;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div style="display:grid;gap:2px;">
        <strong style="font-size:14px;">Pré-visualização da proposta</strong>
        <span style="font-size:12px;color:#475569;">Código: ${record.code || '—'}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="window.print()" style="background:#0f172a;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;">Imprimir / Baixar PDF</button>
      </div>
    </div>
    ${markup}
  </body>
</html>`)
  previewWindow.document.close()
}

export function downloadSavedProposal(record: SavedProposalRecord): void {
  const url = getSavedProposalDownloadUrl(record)

  if (url && typeof window !== 'undefined') {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noreferrer noopener'
    anchor.download = `${record.code || 'proposta'}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return
  }

  const blob = new Blob([JSON.stringify(record.payload ?? {}, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${record.code || 'proposta'}.json`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}
