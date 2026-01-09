import type { SegmentoCliente } from '../finance/roi'
import type { ClienteDados } from '../../types/printableProposal'
import type { RequiredClientField } from './validateRequiredFields'
import { buildRequiredFieldsVenda } from './buildRequiredFieldsVenda'

type BuildRequiredFieldsArgs = {
  cliente: ClienteDados
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro?: string | null
}

export const buildRequiredFieldsLeasing = (
  args: BuildRequiredFieldsArgs,
): RequiredClientField[] => buildRequiredFieldsVenda(args)
