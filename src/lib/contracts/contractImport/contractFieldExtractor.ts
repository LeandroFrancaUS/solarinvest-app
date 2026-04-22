import type { ParsedContractFields } from './types'
import { formatCpfCnpj, parseNumberBR } from './normalizers'

const RE_CONTRACTOR_NAME = /CONTRATANTE:\s*([A-ZÀ-Ý\s]+?),/i
const RE_CONTRACTOR_DOCUMENT = /(?:CPF|CNPJ)\s*(?:sob o nº|nº|no)?\s*([0-9.\-\/]+)/i
const RE_CONTRACTOR_EMAIL = /E-?mail:\s*([^\s]+@[^\s]+)/i
const RE_CONTRACTOR_PHONE = /Telefone:\s*([^\n\r]+)/i
const RE_CONTRACTOR_ADDRESS = /residente e domiciliado\(a\) na\s+([\s\S]+?)\s+Contato do CONTRATANTE/i
const RE_PROPOSAL_CODE = /SLRINVST-[A-Z]+-[0-9]+/i
const RE_KWH_CONTRACTED_1 = /consumo estimado de\s*([0-9.,]+)\s*kWh\s*por\s*m[eê]s/i
const RE_KWH_CONTRACTED_2 = /Energia contratada\s*\(kWh\/m[eê]s\)\s*([0-9.,]+)/i
const RE_TERM_1 = /Prazo contratual\s*([0-9]+)\s*meses/gi
const RE_TERM_2 = /vig[eê]ncia de\s*([0-9]+)\s*meses/gi
const RE_CITY_UF = /([A-ZÀ-Ý\s]+)\/?\s*([A-Z]{2})\s*,\s*\d{1,2}\s+de/i
const RE_UC_NUMBER = /UC\s*(?:n[ºo]|número)?\s*([0-9\-]+)/i
const RE_DISTRIBUTOR = /Distribuidora:\s*([^\n\r]+)/i
const RE_INSTALLATION_TYPE = /Tipo de instala[çc][ãa]o\s*([^\n\r]+)/i
const RE_CONTRACTOR_BLOCK =
  /CONTRATANTE:\s*([\s\S]{0,1200}?)(?:doravante denominado\(a\)\s+CONTRATANTE|Contato do CONTRATANTE)/i
const RE_CITY_STATE_CEP_INLINE =
  /([A-ZÀ-Ý][A-Za-zÀ-ÿ\s'’-]+?)\s*[-/]\s*([A-Z]{2})[\s,\-–]*CEP[:\s]*([0-9]{5}-?[0-9]{3})/i
const RE_CEP = /CEP[:\s]*([0-9]{5}-?[0-9]{3})/i
const RE_CONTACT_BLOCK = /Contato do CONTRATANTE[:\s]*([\s\S]{0,400}?)(?:CL[AÁ]USULA|CONTRATADA|ASSINADO|$)/i
const VALID_UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'])

function sanitizeCity(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.replace(/[^A-Za-zÀ-ÿ\s'’-]/g, '').replace(/\s+/g, ' ').trim()
  if (normalized.length < 3) return null
  return normalized
}

function sanitizeState(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  if (!VALID_UFS.has(normalized)) return null
  return normalized
}

function extractTermCandidates(text: string): number[] {
  const terms = new Set<number>()
  for (const m of text.matchAll(RE_TERM_1)) terms.add(Number(m[1]))
  for (const m of text.matchAll(RE_TERM_2)) terms.add(Number(m[1]))
  return Array.from(terms).filter((n) => Number.isFinite(n))
}

export function extractContractFields(text: string): ParsedContractFields {
  const contractorBlock = text.match(RE_CONTRACTOR_BLOCK)?.[1] ?? ''
  const contactBlock = text.match(RE_CONTACT_BLOCK)?.[1] ?? ''
  const termCandidates = extractTermCandidates(text)
  const kwhRaw = text.match(RE_KWH_CONTRACTED_1)?.[1] ?? text.match(RE_KWH_CONTRACTED_2)?.[1] ?? null
  const cityUfFromBlock = contractorBlock.match(RE_CITY_STATE_CEP_INLINE)
  const cityUfFromGeneric = text.match(RE_CITY_UF)
  const cityCandidate = sanitizeCity(cityUfFromBlock?.[1] ?? cityUfFromGeneric?.[1] ?? null)
  const stateCandidate = sanitizeState(cityUfFromBlock?.[2] ?? cityUfFromGeneric?.[2] ?? null)
  const cepFromBlock = contractorBlock.match(RE_CEP)?.[1] ?? null

  return {
    contractorName: (contractorBlock.match(RE_CONTRACTOR_NAME)?.[1] ?? text.match(RE_CONTRACTOR_NAME)?.[1])?.replace(/\s+/g, ' ').trim() ?? null,
    contractorDocument: formatCpfCnpj(contractorBlock.match(RE_CONTRACTOR_DOCUMENT)?.[1] ?? text.match(RE_CONTRACTOR_DOCUMENT)?.[1] ?? null),
    contractorEmail: contactBlock.match(RE_CONTRACTOR_EMAIL)?.[1] ?? text.match(RE_CONTRACTOR_EMAIL)?.[1] ?? null,
    contractorPhone: contactBlock.match(RE_CONTRACTOR_PHONE)?.[1]?.trim() ?? text.match(RE_CONTRACTOR_PHONE)?.[1]?.trim() ?? null,
    contractorAddress: (contractorBlock.match(RE_CONTRACTOR_ADDRESS)?.[1] ?? text.match(RE_CONTRACTOR_ADDRESS)?.[1])?.replace(/\s+/g, ' ').trim() ?? null,
    proposalCode: text.match(RE_PROPOSAL_CODE)?.[0] ?? null,
    contractualTermMonths: termCandidates.length > 0 ? Math.max(...termCandidates) : null,
    contractualTermCandidates: termCandidates,
    kwhContratado: parseNumberBR(kwhRaw),
    city: cityCandidate,
    state: stateCandidate,
    contractorPostalCode: cepFromBlock,
    distributor: text.match(RE_DISTRIBUTOR)?.[1]?.trim() ?? null,
    unitConsumerNumber: text.match(RE_UC_NUMBER)?.[1] ?? null,
    installationType: text.match(RE_INSTALLATION_TYPE)?.[1]?.trim() ?? null,
  }
}
