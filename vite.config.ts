import { cwd } from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import type { Plugin, ViteDevServer } from 'vite'
import { defineConfig, loadEnv } from 'vite'

import { createAneelProxyMiddleware, DEFAULT_PROXY_BASE } from './server/aneelProxy.js'
import { createContractRenderMiddleware } from './server/contracts.js'

const sanitizeProxyBase = (base?: string) => {
  if (!base) return ''
  const trimmed = base.trim()
  if (!trimmed || !trimmed.startsWith('/')) return ''
  return trimmed.replace(/\/+$/, '') || '/'
}

const aneelProxyPlugin = (proxyBase: string): Plugin => ({
  name: 'aneel-proxy-middleware',
  configureServer(server: ViteDevServer) {
    const middleware = createAneelProxyMiddleware(proxyBase)
    server.middlewares.use((req, res, next) => {
      void middleware(req, res, next)
    })
  },
})

const contractRenderPlugin = (): Plugin => ({
  name: 'contract-render-middleware',
  configureServer(server: ViteDevServer) {
    const middleware = createContractRenderMiddleware()
    server.middlewares.use((req, res, next) => {
      void middleware(req, res, next)
    })
  },
})

const DEFAULT_BACKEND_HOST = '127.0.0.1'
const DEFAULT_BACKEND_PORT = 3000

function resolveBackendOrigin(rawOrigin?: string) {
  const fallback = new URL(`http://${DEFAULT_BACKEND_HOST}:${DEFAULT_BACKEND_PORT}`)
  if (!rawOrigin) {
    return fallback
  }

  const trimmed = rawOrigin.trim()
  if (!trimmed) {
    return fallback
  }

  const ensureProtocol = (value: string) => {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
      return value
    }
    return `http://${value}`
  }

  let parsed: URL
  try {
    parsed = new URL(ensureProtocol(trimmed))
  } catch (error) {
    console.warn(
      `[@solarinvest/dev-proxy] Valor inválido em VITE_BACKEND_ORIGIN (\"${trimmed}\"). ` +
        `Usando ${fallback.origin} como destino do proxy.`,
    )
    return fallback
  }

  if (!parsed.port) {
    parsed.port = String(DEFAULT_BACKEND_PORT)
  }

  if (parsed.hostname === 'localhost' || parsed.hostname === '0.0.0.0') {
    parsed.hostname = DEFAULT_BACKEND_HOST
  }

  return parsed
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')
  const hasProxyEnv = Object.prototype.hasOwnProperty.call(env, 'VITE_ANEEL_PROXY_BASE')
  const proxyBase = hasProxyEnv ? sanitizeProxyBase(env.VITE_ANEEL_PROXY_BASE) : DEFAULT_PROXY_BASE
  const enableProxy = Boolean(proxyBase)

  const plugins: Plugin[] = [react(), contractRenderPlugin()]
  if (enableProxy) {
    plugins.push(aneelProxyPlugin(proxyBase))
  }

  const backendOrigin = resolveBackendOrigin(env.VITE_BACKEND_ORIGIN).origin

  const proxy = ['/auth', '/admin'].reduce<Record<string, { target: string; changeOrigin: true }>>(
    (acc, path) => {
      acc[path] = { target: backendOrigin, changeOrigin: true }
      return acc
    },
    {},
  )

  return {
    plugins,
    build: {
      sourcemap: true,
      target: 'es2020',
      minify: 'terser',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'recharts'],
          },
        },
      },
    },
    server: {
      host: true,
      proxy,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        zustand: fileURLToPath(new URL('./src/lib/zustand-shim.ts', import.meta.url)),
        'zustand/middleware': fileURLToPath(
          new URL('./src/lib/zustand-middleware-shim.ts', import.meta.url),
        ),
        'react-window': fileURLToPath(new URL('./src/lib/react-window.tsx', import.meta.url)),
        '@testing-library/react': fileURLToPath(
          new URL('./src/test-utils/testing-library-react.tsx', import.meta.url),
        ),
      },
    },
    esbuild: {},
  }
})
