import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @imagekit/next has no "node" export condition. Point directly at the CJS
      // build so Vitest can resolve it without a conditions mismatch.
      '@imagekit/next': path.resolve(__dirname, 'node_modules/@imagekit/next/dist/client/index.js'),
    },
  },
})
