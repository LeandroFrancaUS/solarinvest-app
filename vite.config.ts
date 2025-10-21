import { cwd } from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import type { Plugin, ViteDevServer } from 'vite'
import { defineConfig, loadEnv } from 'vite'

import { createAneelProxyMiddleware, DEFAULT_PROXY_BASE } from './server/aneelProxy.js'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')
  const hasProxyEnv = Object.prototype.hasOwnProperty.call(env, 'VITE_ANEEL_PROXY_BASE')
  const proxyBase = hasProxyEnv ? sanitizeProxyBase(env.VITE_ANEEL_PROXY_BASE) : DEFAULT_PROXY_BASE
  const enableProxy = Boolean(proxyBase)

  return {
    plugins: enableProxy ? [react(), aneelProxyPlugin(proxyBase)] : [react()],
    build: { sourcemap: true },
    server: {
      host: true,
    },
    resolve: {
      alias: {
        zustand: fileURLToPath(new URL('./src/lib/zustand-shim.ts', import.meta.url)),
        'zustand/middleware': fileURLToPath(
          new URL('./src/lib/zustand-middleware-shim.ts', import.meta.url),
        ),
      },
    },
    esbuild: {},
  }
})
