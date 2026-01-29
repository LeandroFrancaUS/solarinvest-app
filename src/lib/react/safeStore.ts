import { useRef, useSyncExternalStore } from 'react'

type SubscribeFn = (listener: () => void) => () => void

type GetSnapshotFn<T> = () => T

export function useSafeStore<T>(subscribe: SubscribeFn, getSnapshot: GetSnapshotFn<T>): T {
  const cache = useRef<T>(getSnapshot())

  return useSyncExternalStore(
    subscribe,
    () => {
      const next = getSnapshot()
      if (Object.is(cache.current, next)) {
        return cache.current
      }
      cache.current = next
      return next
    },
    () => cache.current,
  )
}
