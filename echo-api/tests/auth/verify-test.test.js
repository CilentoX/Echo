import { setPrismaClient, authenticate } from '../src/plugins/auth.js'
import Fastify from 'fastify'

// Check the prismaClient state after import
console.log('After import, about to setPrismaClient')

const mockPrisma = {
  userToken: {
    findUnique: async (where) => {
      console.log('Mock findUnique called with userId:', where?.userId)
      if (where?.userId === 'test-api-key-user123') {
        return {
          userId: 'test-api-key-user123',
          accessToken: 'encrypted-test-access-token',
          deviceId: 'test-device-001',
        }
      }
      if (where?.userId === 'testuser:matrix.org') {
        return {
          userId: 'testuser:matrix.org',
          accessToken: 'encrypted-bearer-token',
          deviceId: 'test-device-002',
        }
      }
      console.log('Mock findUnique: no match, returning null')
      return null
    },
  },
  $disconnect: async () => {},
  $transaction: async (fn) => fn(),
  $use: () => {},
}

setPrismaClient(mockPrisma)
console.log('setPrismaClient done')

// Now import authenticate - it should use the set prismaClient
import { authenticate } from '../src/plugins/auth.js'
console.log('authenticate imported')

// Quick test - create a minimal Fastify app
const app = Fastify({ logger: false })
app.post('/test', async (request, reply) => {
  console.log('Route handler: about to call authenticate')
  await authenticate(request, reply)
  console.log('Route handler: after authenticate, request.user:', request.user)
  return { user: request.user }
})

;(async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/test',
    headers: {
      'x-api-key': 'test-api-key-user123',
    },
  })
  console.log('Response status:', response.statusCode)
  console.log('Response body:', response.json())
  await app.close()
})()