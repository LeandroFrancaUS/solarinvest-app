import { describe, expect, it } from 'vitest'

import { toUint8 } from '../input'

describe('toUint8', () => {
  it('converte File para Uint8Array', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' })
    const file = new File([blob], 'dados.bin', { type: 'application/octet-stream' })

    const resultado = await toUint8(file)

    expect(resultado).toBeInstanceOf(Uint8Array)
    expect(Array.from(resultado)).toEqual([1, 2, 3, 4])
  })
})
