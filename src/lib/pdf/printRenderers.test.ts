import { describe, expect, it } from 'vitest'
import { sanitizePrintableHtml, buildProposalPdfDocument } from './printRenderers'

describe('sanitizePrintableHtml', () => {
  it('retorna null sem modificação quando a entrada é null', () => {
    expect(sanitizePrintableHtml(null)).toBeNull()
  })

  it('remove artefato "html coding" da string', () => {
    const result = sanitizePrintableHtml('<div>html coding</div>')
    expect(result).toBe('<div></div>')
  })

  it('remove "html coding" de forma case-insensitive', () => {
    const result = sanitizePrintableHtml('<div>HTML CODING</div>')
    expect(result).toBe('<div></div>')
  })

  it('remove "html coding" com espaços variáveis', () => {
    const result = sanitizePrintableHtml('abc html   coding xyz')
    expect(result).toBe('abc  xyz')
  })

  it('não altera HTML válido sem o artefato', () => {
    const html = '<div class="page"><h1>Proposta</h1></div>'
    expect(sanitizePrintableHtml(html)).toBe(html)
  })

  it('aplica trim no resultado', () => {
    const result = sanitizePrintableHtml('  <p>texto</p>  ')
    expect(result).toBe('<p>texto</p>')
  })
})

describe('buildProposalPdfDocument', () => {
  it('gera documento HTML completo com variant padrão', () => {
    const doc = buildProposalPdfDocument('<p>conteúdo</p>', 'Cliente Teste')
    expect(doc).toContain('<!DOCTYPE html>')
    expect(doc).toContain('data-print-mode="download"')
    expect(doc).toContain('data-print-variant="standard"')
    expect(doc).toContain('Proposta-Cliente Teste')
    expect(doc).toContain('<p>conteúdo</p>')
  })

  it('usa variant informado quando fornecido', () => {
    const doc = buildProposalPdfDocument('<p>tabela</p>', 'Teste', 'buyout')
    expect(doc).toContain('data-print-variant="buyout"')
  })

  it('aplica fallback "SolarInvest" quando nomeCliente está vazio', () => {
    const doc = buildProposalPdfDocument('<p/>', '')
    expect(doc).toContain('Proposta-SolarInvest')
  })

  it('aplica fallback "SolarInvest" quando nomeCliente é apenas espaços', () => {
    const doc = buildProposalPdfDocument('<p/>', '   ')
    expect(doc).toContain('Proposta-SolarInvest')
  })

  it('delega ao buildBentoLeasingPdfDocument quando HTML contém marcador Bento', () => {
    const bentoHtml = '<div data-testid="proposal-bento-root"><p>bento</p></div>'
    const doc = buildProposalPdfDocument(bentoHtml, 'Bento Cliente')
    // Bento document must NOT contain the legacy preview-container wrapper
    expect(doc).not.toContain('class="preview-container"')
    // Bento document must include the lang attribute added by buildBentoLeasingPdfDocument
    expect(doc).toContain('lang="pt-BR"')
  })
})
