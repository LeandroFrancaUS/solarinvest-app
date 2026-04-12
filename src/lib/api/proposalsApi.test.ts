import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteProposal, updateProposal } from './proposalsApi'

describe('proposalsApi delete flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses DELETE when removing a proposal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await deleteProposal('456')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/proposals/456'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('keeps PATCH for proposal updates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '456' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await updateProposal('456', { client_name: 'Alice' })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/proposals/456'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})
