/**
 * React hook for connectivity state.
 */

import { useState, useEffect } from 'react'
import {
  getConnectivityState,
  onConnectivityChange,
  type ConnectivityState,
} from './connectivityService'

export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(getConnectivityState)
  useEffect(() => {
    const unsub = onConnectivityChange(setState)
    return unsub
  }, [])
  return state
}
