import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: __dirname,
  test: {
    include: ['tests/**/*.test.js'],
  },
  resolve: {
    alias: {
      '../src/lib/matrix/client.js': '/src/lib/matrix/client.js',
      '../src/lib/matrix/proxy.js': '/src/lib/matrix/proxy.js',
    },
  },
})