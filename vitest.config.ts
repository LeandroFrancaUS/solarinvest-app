import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-window': fileURLToPath(new URL('./src/lib/react-window.tsx', import.meta.url)),
      '@testing-library/react': fileURLToPath(
        new URL('./src/test-utils/testing-library-react.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
})
