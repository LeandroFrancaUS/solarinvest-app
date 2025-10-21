import { useSyncExternalStore } from 'react'

export type PartialState<T> = Partial<T> | ((state: T) => Partial<T>)

export type StateCreator<T> = (
  set: (partial: PartialState<T>, replace?: boolean) => void,
  get: () => T,
  api: StoreApi<T>,
) => T

export type StoreApi<T> = {
  getState: () => T
  setState: (partial: PartialState<T>, replace?: boolean) => void
  subscribe: (listener: (state: T, previousState: T) => void) => () => void
}

export type UseBoundStore<T> = (<U>(selector: (state: T) => U) => U) & StoreApi<T>

const identity = <T,>(value: T): T => value

export function create<T>(initializer: StateCreator<T>): UseBoundStore<T> {
  let state: T
  const listeners = new Set<(state: T, previous: T) => void>()

  const getState = () => state

  const setState = (partial: PartialState<T>, replace = false) => {
    const partialState = typeof partial === 'function' ? (partial as (draft: T) => Partial<T>)(state) : partial
    const nextState = replace ? (partialState as T) : { ...state, ...partialState }
    const previousState = state
    if (Object.is(nextState, previousState)) {
      return
    }
    state = nextState
    listeners.forEach((listener) => {
      try {
        listener(state, previousState)
      } catch (error) {
        console.error('[zustand-shim] listener error', error)
      }
    })
  }

  const subscribe = (listener: (state: T, previousState: T) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const api: StoreApi<T> = {
    getState,
    setState,
    subscribe,
  }

  state = initializer(setState, getState, api)

  const useStore = (<U>(selector: (state: T) => U = identity as unknown as (state: T) => U): U =>
    useSyncExternalStore(
      (onStoreChange) => subscribe(() => onStoreChange()),
      () => selector(getState()),
      () => selector(getState()),
    )) as UseBoundStore<T>

  useStore.getState = getState
  useStore.setState = setState
  useStore.subscribe = (listener) => subscribe(listener)

  return useStore
}

export type { StateCreator as StateCreatorImpl }
