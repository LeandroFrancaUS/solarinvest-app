import { useMemo } from 'react'

export interface FlowStepRequirement {
  stepIndex: number
  fieldId: string
  label: string
  isValid: boolean
}

export function useFlowValidation(requirements: FlowStepRequirement[]) {
  return useMemo(() => {
    const pending = requirements.filter((req) => !req.isValid)
    const first = pending[0]
    return {
      pending,
      first,
      isComplete: pending.length === 0,
    }
  }, [requirements])
}
