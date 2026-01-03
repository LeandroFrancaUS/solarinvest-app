export const FEATURE_FLOW_V5_DEFAULT_ON = true

const STORAGE_KEY = 'flowV5Enabled'

const parseEnvFlag = () => {
  const envValue = import.meta?.env?.VITE_FLOW_V5_ENABLED
  if (envValue === undefined) return null
  if (envValue === 'true' || envValue === '1') return true
  if (envValue === 'false' || envValue === '0') return false
  return null
}

export function isFlowV5Enabled(): boolean {
  const envFlag = parseEnvFlag()
  if (envFlag != null) return envFlag

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  }

  return FEATURE_FLOW_V5_DEFAULT_ON
}

export function toggleFlowV5(enabled: boolean) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  }
}
