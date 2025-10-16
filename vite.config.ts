import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createAneelProxyMiddleware, DEFAULT_PROXY_BASE } from './server/aneelProxy.js'

const sanitizeProxyBase = (base?: string) => {
  if (!base) return ''
  const trimmed = base.trim()
  if (!trimmed || !trimmed.startsWith('/')) return ''
  return trimmed.replace(/\/+$/, '') || '/'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
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
          server.middlewares.use(createAneelProxyMiddleware(proxyBase))
        },
      },
    ],
    server: {
      host: true,
    },
  }
})
