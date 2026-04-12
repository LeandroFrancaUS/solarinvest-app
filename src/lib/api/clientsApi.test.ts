import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteClientById, updateClientById } from './clientsApi'

describe('clientsApi delete flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses DELETE instead of PUT when removing a client', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ deletedId: '123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await deleteClientById('123')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/clients/123'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('surfaces backend error message when delete fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Sem permissão.' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(deleteClientById('123')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Sem permissão.',
    })
  })

  it('keeps PUT for client updates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '123' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await updateClientById('123', { name: 'Alice' })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/clients/123'),
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})
