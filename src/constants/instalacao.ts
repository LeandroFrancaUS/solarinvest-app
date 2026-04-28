import type { TipoInstalacao } from '../shared/ufvComposicao'
import type { TipoRede } from '../shared/rede'

export const TIPOS_INSTALACAO: { value: TipoInstalacao; label: string }[] = [
  { value: 'fibrocimento', label: 'Telhado de fibrocimento' },
  { value: 'metalico', label: 'Telhas metálicas' },
  { value: 'ceramico', label: 'Telhas cerâmicas' },
  { value: 'laje', label: 'Laje' },
  { value: 'solo', label: 'Solo' },
  { value: 'outros', label: 'Outros (texto)' },
]

export const TIPOS_REDE: { value: TipoRede; label: string }[] = [
  { value: 'nenhum', label: 'Não informado' },
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'bifasico', label: 'Bifásico' },
  { value: 'trifasico', label: 'Trifásico' },
]
