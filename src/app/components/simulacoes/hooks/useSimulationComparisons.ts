import { useEffect, useMemo, useRef, useState } from 'react'

import type { Simulacao } from '../../../../lib/finance/simulation'
import type { SimulationComparisonResult } from '../../../../workers/simulationWorker'

type ComputeRequest = {
  id: number
  type: 'COMPUTE'
  payload: {
    simulations: Simulacao[]
    comparisonHorizon: number
  }
}

type ComputeResponse = {
  id: number
  type: 'COMPUTE_RESULT'
  payload: SimulationComparisonResult[]
}

const isComputeResponse = (value: unknown): value is ComputeResponse => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<ComputeResponse>
  return candidate.type === 'COMPUTE_RESULT' && Array.isArray(candidate.payload)
}

export const useSimulationComparisons = (
  simulations: Simulacao[],
  comparisonHorizon: number,
): SimulationComparisonResult[] => {
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [results, setResults] = useState<SimulationComparisonResult[]>([])

  useEffect(() => {
    const worker = new Worker(new URL('../../../../workers/simulationWorker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    setReady(true)

    return () => {
      workerRef.current = null
      worker.terminate()
    }
  }, [])

  const payload = useMemo(
    () => ({
      simulations,
      comparisonHorizon,
    }),
    [comparisonHorizon, simulations],
  )

  useEffect(() => {
    const worker = workerRef.current
    if (!ready || !worker) {
      if (payload.simulations.length === 0) {
        setResults([])
      }
      return
    }

    if (payload.simulations.length === 0) {
      setResults([])
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    let cancelled = false

    const handleMessage = (event: MessageEvent<ComputeResponse>) => {
      if (cancelled) {
        return
      }
      const message = event.data
      if (!isComputeResponse(message) || message.id !== requestId) {
        return
      }
      setResults(message.payload)
    }

    worker.addEventListener('message', handleMessage)

    const message: ComputeRequest = {
      id: requestId,
      type: 'COMPUTE',
      payload: payload,
    }
    worker.postMessage(message)

    return () => {
      cancelled = true
      worker.removeEventListener('message', handleMessage)
    }
  }, [payload, ready])

  return results
}
