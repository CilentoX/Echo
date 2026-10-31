import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: __dirname,
  test: {
    include: ['tests/**/*.test.js'],
    mockEnv: ['TOKEN_ENCRYPTION_KEY'],
  },
  resolve: {
    alias: {
      '../src/lib/matrix/client.js': '/src/lib/matrix/client.js',
      '../src/lib/matrix/proxy.js': '/src/lib/matrix/proxy.js',
      '../src/lib/auth/tokenStore.js': '/src/lib/auth/tokenStore.js',
      '../src/plugins/auth.js': '/src/plugins/auth.js',
      '../src/db.js': '/src/db.js',
    },
  },
})