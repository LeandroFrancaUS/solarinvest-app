import type { PrintableProposalProps } from '../../types/printableProposal'
import { IMPORT_MARKER_END, IMPORT_MARKER_START } from '../../types/proposalImport'
import type { PropostaImportData } from '../../types/proposalImport'

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/** Base64-encode a possibly unicode string. */
export function encodeImportPayload(data: PropostaImportData): string {
  const json = JSON.stringify(data)
  // encodeURIComponent handles non-ASCII; escape converts percent-encoded back
  // to a safe string for btoa which only handles Latin-1.
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `${IMPORT_MARKER_START}${b64}${IMPORT_MARKER_END}`
}

/** Decode a base64 payload (inverse of encodeImportPayload). */
function decodeImportPayload(b64: string): PropostaImportData | null {
  try {
    const json = decodeURIComponent(escape(atob(b64)))
    const parsed: unknown = JSON.parse(json)
    if (parsed !== null && typeof parsed === 'object' && (parsed as { _v?: unknown })._v === 1) {
      return parsed as PropostaImportData
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Building the payload from PrintableProposalProps
// ---------------------------------------------------------------------------

/**
 * Build a {@link PropostaImportData} from the printable proposal props.
 * Called inside the printable component so the metadata is self-contained.
 */
export function buildImportPayloadFromProps(props: PrintableProposalProps): PropostaImportData {
  const snap = props.vendaSnapshot
  const parametros = snap?.parametros
  const configuracao = snap?.configuracao
  return {
    _v: 1,
    tipo: props.tipoProposta,
    cliente: { ...props.cliente },
    consumo_kwh_mes: parametros?.consumo_kwh_mes ?? 0,
    tarifa_r_kwh: parametros?.tarifa_r_kwh ?? props.tarifaCheia ?? 0,
    inflacao_energia_aa: parametros?.inflacao_energia_aa ?? 0,
    uf: parametros?.uf ?? props.cliente.uf ?? '',
    distribuidora: parametros?.distribuidora ?? props.distribuidoraTarifa ?? '',
    irradiacao_kwhm2_dia: parametros?.irradiacao_kwhm2_dia ?? undefined,
    potencia_modulo_wp: configuracao?.potencia_modulo_wp ?? undefined,
    n_modulos: configuracao?.n_modulos ?? props.numeroModulos ?? undefined,
    geracao_estimada_kwh_mes:
      configuracao?.geracao_estimada_kwh_mes ?? props.geracaoMensalKwh ?? undefined,
    tipo_instalacao: configuracao?.tipo_instalacao ?? props.tipoInstalacao ?? undefined,
    tipo_sistema: configuracao?.tipo_sistema ?? props.tipoSistema ?? undefined,
    modelo_modulo: configuracao?.modelo_modulo ?? undefined,
    modelo_inversor: configuracao?.modelo_inversor ?? undefined,
    desconto_pct: props.descontoContratualPct ?? undefined,
    leasing_prazo_meses: props.leasingPrazoContratualMeses ?? undefined,
    orcamento_itens: (props.orcamentoItens ?? []).map((item) => ({
      produto: item.produto,
      descricao: item.descricao,
      quantidade: item.quantidade ?? undefined,
      precoUnit: item.valorUnitario ?? undefined,
      precoTotal: item.valorTotal ?? undefined,
    })),
    valor_total: props.valorTotalProposta ?? undefined,
    budget_id: props.budgetId ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Extraction from PDF text
// ---------------------------------------------------------------------------

/**
 * Given the full text extracted from a PDF, look for the embedded import marker
 * and decode the {@link PropostaImportData} from it.
 * Returns `null` if no marker is found or decoding fails.
 */
export function extractProposalImportData(pdfText: string): PropostaImportData | null {
  const startIdx = pdfText.indexOf(IMPORT_MARKER_START)
  if (startIdx === -1) {
    return null
  }
  const afterStart = pdfText.slice(startIdx + IMPORT_MARKER_START.length)
  const endIdx = afterStart.indexOf(IMPORT_MARKER_END)
  if (endIdx === -1) {
    return null
  }
  // Remove any whitespace/newlines inserted by the PDF renderer
  const raw = afterStart.slice(0, endIdx).replace(/\s+/g, '')
  return decodeImportPayload(raw)
}
