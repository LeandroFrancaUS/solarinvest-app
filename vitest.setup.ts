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
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }
  if (typeof Worker === 'undefined') {
    ;(globalThis as Record<string, unknown>).Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null
      onerror: ((e: ErrorEvent) => void) | null = null
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() {
        return false
      }
    }
  }
  if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
        reader.readAsArrayBuffer(this)
      })
    }
  }
})

afterEach(() => {
  cleanup()
})
