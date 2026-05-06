import type { ParsedSignature, SignatureRoleHint } from './types'
import { brDateTimeToISO, formatCpfCnpj, normalizeDocument } from './normalizers'

const RE_SIGNER_BLOCK =
  /Assinado eletronicamente por\s+([\s\S]{0,120}?)\s+Data:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2})[\s\S]{0,180}?SIGNAT[ÁA]RIO[\s\S]{0,120}?([0-9.\-\/]{11,18})?/gi

const RE_SIGNER_NAME_LINE = /Assinado eletronicamente por\s+([A-Za-zÀ-ÿ\s]+)\s+Data:/i
const RE_SIGNER_DOC = /([0-9]{3}\.[0-9]{3}\.[0-9]{3}\-[0-9]{2}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}\-[0-9]{2})/i

function inferRole(rawBlock: string): SignatureRoleHint {
  const normalized = rawBlock.toLowerCase()
  if (normalized.includes('correspons')) return 'corresponsavel'
  if (normalized.includes('propriet')) return 'proprietario'
  if (normalized.includes('solarinvest')) return 'solarinvest'
  if (normalized.includes('contratante')) return 'contratante'
  return 'unknown'
}

export function parseSignaturesFromText(text: string): ParsedSignature[] {
  const signatures: ParsedSignature[] = []
  for (const match of text.matchAll(RE_SIGNER_BLOCK)) {
    const rawBlock = match[0]
    const signerName = match[1]?.replace(/\s+/g, ' ').trim() || null
    const signedAt = brDateTimeToISO(match[2] ?? '')
    const directDoc = match[3] ?? rawBlock.match(RE_SIGNER_DOC)?.[1] ?? null
    signatures.push({
      signerName,
      signedAt,
      signerDocument: formatCpfCnpj(directDoc),
      roleHint: inferRole(rawBlock),
      rawBlock,
    })
  }

  if (signatures.length === 0) {
    const blocks = text.split(/(?=Assinado eletronicamente por)/gi).filter((b) => b.includes('Assinado eletronicamente por'))
    for (const rawBlock of blocks) {
      const name = rawBlock.match(RE_SIGNER_NAME_LINE)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
      const dateRaw = rawBlock.match(/Data:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2})/i)?.[1]
      const docRaw = rawBlock.match(RE_SIGNER_DOC)?.[1] ?? null
      signatures.push({
        signerName: name,
        signerDocument: formatCpfCnpj(docRaw),
        signedAt: dateRaw ? brDateTimeToISO(dateRaw) : null,
        roleHint: inferRole(rawBlock),
        rawBlock,
      })
    }
  }

  return signatures.filter((sig) => sig.signerName || normalizeDocument(sig.signerDocument) || sig.signedAt)
}
