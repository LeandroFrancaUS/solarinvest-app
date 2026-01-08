import { buildRequiredFieldsVenda } from './buildRequiredFieldsVenda'
import type { RequiredClientField } from './clientRequiredFields'

export function buildRequiredFieldsLeasing(): RequiredClientField[] {
  return buildRequiredFieldsVenda()
}
