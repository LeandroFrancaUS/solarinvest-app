import React from 'react'
import { describe, expect, it } from 'vitest'

import { render } from '@testing-library/react'
import { SimulacoesDashboard } from '../SimulacoesDashboard'

describe('SimulacoesDashboard smoke', () => {
  it('renderiza o conteúdo principal sem loops de atualização', () => {
    const { container } = render(
      <SimulacoesDashboard
        consumoKwhMes={500}
        valorInvestimento={25000}
        tipoSistema="ON_GRID"
        prazoLeasingAnos={5}
      />,
    )

    expect(container.textContent ?? '').toContain('Simulações salvas')
  })
})
