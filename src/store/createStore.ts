import { useRef, useSyncExternalStore } from 'react'

type PartialState<T> = T | Partial<T> | ((state: T) => T | Partial<T>)
type SetState<T> = (partial: PartialState<T>, replace?: boolean) => void
type GetState<T> = () => T

type StoreListener<T> = (state: T, prevState: T) => void

type Subscribe<T> = (listener: StoreListener<T>) => () => void

type UseBoundStore<T> = {
  (): T
  <U>(selector: (state: T) => U, equalityFn?: (a: U, b: U) => boolean): U
  setState: SetState<T>
  getState: GetState<T>
  subscribe: Subscribe<T>
}

const identity = <T>(value: T) => value

export const createStore = <T>(initializer: (set: SetState<T>, get: GetState<T>) => T): UseBoundStore<T> => {
  let state: T
  const listeners = new Set<StoreListener<T>>()

  const setState: SetState<T> = (partial, replace = false) => {
    const partialState =
      typeof partial === 'function'
        ? (partial as (state: T) => T | Partial<T>)(state)
        : partial

    if (partialState === undefined) {
      return
    }

    if (partialState === state) {
      return
    }

    const nextState = replace
      ? (partialState as T)
      : Object.assign({}, state, partialState as Partial<T>)

    if (Object.is(nextState, state)) {
      return
    }

    const previousState = state
    state = nextState

    listeners.forEach((listener) => {
      listener(state, previousState)
    })
  }

  const getState: GetState<T> = () => state

  const subscribe: Subscribe<T> = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  state = initializer(setState, getState)

  const useBoundStore = (<U>(
    selector?: (state: T) => U,
    equalityFn: (a: U, b: U) => boolean = Object.is,
  ): U => {
    const select = (selector ?? (identity as unknown)) as (state: T) => U
    const sliceRef = useRef(select(state))
    const selectorRef = useRef(select)
    const equalityRef = useRef(equalityFn)

    selectorRef.current = select
    equalityRef.current = equalityFn

    const getSelectedState = () => {
      const selected = selectorRef.current(state)
      sliceRef.current = selected
      return selected
    }

    const subscribeToStore = (notify: () => void) =>
      subscribe((nextState) => {
        const selected = selectorRef.current(nextState)
        if (!equalityRef.current(selected, sliceRef.current)) {
          sliceRef.current = selected
          notify()
        }
      })

    return useSyncExternalStore(subscribeToStore, getSelectedState, getSelectedState)
  }) as UseBoundStore<T>

  useBoundStore.setState = setState
  useBoundStore.getState = getState
  useBoundStore.subscribe = subscribe

  return useBoundStore
}
