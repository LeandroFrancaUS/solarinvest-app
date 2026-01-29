import React from 'react'
import { describe, expect, it } from 'vitest'

import App from '../../App'
import { Boundary } from '../../app/Boundary'
import { render } from '../../test-utils/testing-library-react'

const selectAlert = (container: HTMLElement) => container.querySelector('[role="alert"]')

describe('App bootstrap', () => {
  it('renderiza o aplicativo sem acionar o Boundary de erro', () => {
    const { container } = render(
      <Boundary>
        <App />
      </Boundary>,
    )

    const alert = selectAlert(container)
    expect(alert).toBeNull()
  })
})
