import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const sanitizeProxyBase = (base?: string) => {
  if (!base) return ''
  const trimmed = base.trim()
  if (!trimmed || !trimmed.startsWith('/')) return ''
  return trimmed.replace(/\/+$/, '')
}

const sanitizeProxyTarget = (target?: string) => {
  if (!target) return 'https://dadosabertos.aneel.gov.br'
  const trimmed = target.trim()
  if (!trimmed) return 'https://dadosabertos.aneel.gov.br'
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'https://dadosabertos.aneel.gov.br'
  }
  return trimmed.replace(/\/+$/, '')
}

const escapeRegex = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyBase = sanitizeProxyBase(env.VITE_ANEEL_PROXY_BASE)
  const proxyTarget = sanitizeProxyTarget(env.VITE_ANEEL_PROXY_TARGET)

  const proxy = proxyBase
    ? {
        [proxyBase]: {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(new RegExp(`^${escapeRegex(proxyBase)}`), ''),
        },
      }
    : undefined

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy,
    },
  }
})
