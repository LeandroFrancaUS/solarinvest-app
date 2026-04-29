import type { SegmentoCliente } from '../lib/finance/roi'

export const isSegmentoCondominio = (segmento: SegmentoCliente) =>
  segmento === 'cond_vertical' || segmento === 'cond_horizontal'
