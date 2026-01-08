import type { RequiredClientField } from './validateRequiredFields'
import { buildRequiredFieldsVenda, type BuildRequiredFieldsParams } from './buildRequiredFieldsVenda'

export const buildRequiredFieldsLeasing = (
  params: BuildRequiredFieldsParams,
): RequiredClientField[] => buildRequiredFieldsVenda(params)
