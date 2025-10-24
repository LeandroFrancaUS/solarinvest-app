import { describe, expect, test } from 'vitest'

import { parseStructuredBudget } from '../../utils/structuredBudgetParser'

const SAMPLE_LINES = [
  'Proposta SolarInvest',
  'Cliente: João da Silva',
  'Documento: 123.456.789-00',
  'Endereço: Rua das Flores, 100 - Curitiba/PR',
  'Produto Quantidade Valor',
  'Módulo Solar 550W 12 un',
  'Inversor Monofásico 01 un',
  'Cabo Solar 4mm² 100 m',
  'Valor total: R$ 45.678,90',
  'Observação: Valores válidos por 30 dias.',
]

describe('pdf parser guard rails', () => {
  test('extrai itens entre cabeçalho e rodapé da proposta', () => {
    const resultado = parseStructuredBudget(SAMPLE_LINES)

    expect(resultado.itens).toHaveLength(3)
    expect(resultado.itens[0]?.produto).toContain('Módulo Solar 550W')
    expect(resultado.itens[1]?.produto).toContain('Inversor Monofásico')
    expect(resultado.itens[2]?.produto).toContain('Cabo Solar 4mm²')
  })

  test('normaliza valores no formato brasileiro', () => {
    const resultado = parseStructuredBudget(SAMPLE_LINES)

    expect(resultado.resumo.valorTotal).toBeCloseTo(45678.9)
  })

  test('ignora informações do cliente ao montar a lista de itens', () => {
    const resultado = parseStructuredBudget(SAMPLE_LINES)

    const possuiClienteComoItem = resultado.itens.some((item) =>
      (item.descricao ?? '').includes('Cliente:'),
    )
    expect(possuiClienteComoItem).toBe(false)
  })
})
