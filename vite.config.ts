import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { cwd } from 'node:process'

import { createAneelProxyMiddleware, DEFAULT_PROXY_BASE } from './server/aneelProxy.js'

const sanitizeProxyBase = (base?: string) => {
  if (!base) return ''
  const trimmed = base.trim()
  if (!trimmed || !trimmed.startsWith('/')) return ''
  return trimmed.replace(/\/+$/, '') || '/'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')
  const hasProxyEnv = Object.prototype.hasOwnProperty.call(env, 'VITE_ANEEL_PROXY_BASE')
  const proxyBase = hasProxyEnv ? sanitizeProxyBase(env.VITE_ANEEL_PROXY_BASE) : DEFAULT_PROXY_BASE
  const enableProxy = Boolean(proxyBase)

  return {
    plugins: [
      react(),
      {
        name: 'aneel-proxy-middleware',
        configureServer(server) {
          if (!enableProxy) {
            return
          }
          const middleware = createAneelProxyMiddleware(proxyBase)
          server.middlewares.use((req, res, next) => {
            void middleware(req, res, next)
          })
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    build: {
      sourcemap: true,
    },
    esbuild: {
      sourcefile: true,
    },
    server: {
      host: true,
    },
  }
})
