import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    setupFiles: ['tests/integration/load-env.ts'],
    testTimeout: 120000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
