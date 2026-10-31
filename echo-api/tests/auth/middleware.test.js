import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
// Import auth functions
import { setPrismaClient, authenticate } from '../src/plugins/auth.js'
import { encrypt } from '../src/lib/auth/tokenStore.js'

// Set encryption key for tests
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!!'

// Set up mock prisma client
const mockPrisma = {
  userToken: {
    findUnique: async (args) => {
      const where = args?.where
      console.log('Mock findUnique called with userId:', where?.userId)
      if (where?.userId === 'test-api-key-user123') {
        return {
          userId: 'test-api-key-user123',
          accessToken: encrypt('test-access-token'),
          deviceId: 'test-device-001',
        }
      }
      if (where?.userId === 'dummy-jwt-token') {
        return {
          userId: 'dummy-jwt-token',
          accessToken: encrypt('bearer-access-token'),
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

// Set the prisma client globally before tests
setPrismaClient(mockPrisma)

describe('Auth Middleware - Integration X-API-Key', () => {
  let app
  const testApiKey = 'test-api-key-user123'

  beforeEach(async () => {
    app = Fastify({ logger: false })
    app.post('/test', async (request, reply) => {
      await authenticate(request, reply)
      return { user: request.user }
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('should authenticate with valid X-API-Key and populate request.user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        'x-api-key': testApiKey,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.user).toBeDefined()
    expect(body.user.userId).toBe(testApiKey)
    expect(typeof body.user.accessToken).toBe('string')
    expect(body.user.deviceId).toBeDefined()
  })

  it('should return 401 when X-API-Key is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toContain('Unauthorized')
  })

  it('should return 401 when X-API-Key is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        'x-api-key': 'invalid-key',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toContain('Unauthorized')
  })
})

describe('Auth Middleware - Integration Bearer Token', () => {
  let app
  const testUserId = 'dummy-jwt-token'

  beforeEach(async () => {
    app = Fastify({ logger: false })
    app.post('/test', async (request, reply) => {
      await authenticate(request, reply)
      return { user: request.user }
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('should authenticate with valid Bearer token and populate request.user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        authorization: 'Bearer dummy-jwt-token',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.user).toBeDefined()
    expect(body.user.userId).toBe(testUserId)
    expect(typeof body.user.accessToken).toBe('string')
    expect(body.user.deviceId).toBeDefined()
  })

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toContain('Unauthorized')
  })
})