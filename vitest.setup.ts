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

  // jsdom 27 does not implement Blob.prototype.arrayBuffer; polyfill via FileReader.
  if (
    typeof Blob !== 'undefined' &&
    typeof (Blob.prototype as { arrayBuffer?: unknown }).arrayBuffer !== 'function'
  ) {
    ;(Blob.prototype as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
      function (): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as ArrayBuffer)
          reader.onerror = reject
          reader.readAsArrayBuffer(this)
        })
      }
  }

  // jsdom does not implement window.matchMedia; provide a minimal stub.
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
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

  // jsdom does not implement Worker; provide a minimal no-op stub for smoke tests.
  if (typeof Worker === 'undefined') {
    class WorkerStub {
      onmessage: ((ev: MessageEvent) => void) | null = null
      onerror: ((ev: ErrorEvent) => void) | null = null
      postMessage(): void {}
      terminate(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean { return false }
    }
    Object.defineProperty(globalThis, 'Worker', {
      value: WorkerStub,
      writable: true,
      configurable: true,
    })
  }
})

afterEach(() => {
  cleanup()
})
