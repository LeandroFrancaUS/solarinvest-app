import { describe, expect, it } from 'vitest'
import { buildMicroBlocks, MicroBlockId } from '../bento/microBlocks'

describe('Bento micro blocks compliance', () => {
  it('avoids forbidden commercial energy terms', () => {
    const blocks = buildMicroBlocks({
      potenciaKwp: 4.8,
      geracaoKwhMes: 652,
      prazoMeses: 60,
      showROI: true,
      showComparativo: true,
    })
    const content = blocks
      .map((block) => `${block.title ?? ''} ${block.body}`.toLowerCase())
      .join(' ')

    const forbiddenTerms = [
      'venda de energia',
      'fornecimento de energia pela solarinvest',
      'tarifa solarinvest',
      'preço do kwh solarinvest',
    ]

    forbiddenTerms.forEach((term) => {
      expect(content).not.toContain(term)
    })
  })

  it('includes the mandatory legal disclaimer text', () => {
    const blocks = buildMicroBlocks({
      potenciaKwp: null,
      geracaoKwhMes: null,
      prazoMeses: null,
      showROI: false,
      showComparativo: false,
    })
    const mb11 = blocks.find((block) => block.id === MicroBlockId.MB11)
    expect(mb11?.body).toContain('A SolarInvest não comercializa energia elétrica')
  })
})
