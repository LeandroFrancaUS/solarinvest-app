// vitest.server.config.ts
// Separate vitest config for server-side Node.js tests.
// Run with: vitest run --config vitest.server.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.spec.{js,ts}'],
    coverage: {
      provider: 'v8',
    },
  },
})
