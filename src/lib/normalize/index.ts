// Individual document type modules
export * from './cpf'
export * from './cnpj'
// Unified document detection (CPF + CNPJ). Re-exports from cpf/cnpj are intentionally
// omitted here to avoid duplicate export conflicts with the lines above.
export {
  type DocumentType,
  type NormalizedDocument,
  detectDocumentType,
  normalizeDocument,
  isValidDocument,
  normalizeAndValidateDocument,
} from './document'
export * from './contact'
export * from './address'
