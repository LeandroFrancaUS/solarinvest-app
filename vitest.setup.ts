import { afterEach, beforeAll } from 'vitest'

import { cleanup } from './src/test-utils/testing-library-react'

beforeAll(() => {
  if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
        callback(timestamp)
      }, 0)
  }
  if (typeof window !== 'undefined' && !window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle: number) => {
      clearTimeout(handle)
    }
  }
})

afterEach(() => {
  cleanup()
})
