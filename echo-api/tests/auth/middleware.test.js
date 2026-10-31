import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
// Import auth functions - set prisma client before running tests
import { setPrismaClient, authenticate } from '../src/plugins/auth.js'

// Set up mock prisma client
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

// Set the prisma client globally before tests
setPrismaClient(mockPrisma)

describe('Auth Middleware - Integration X-API-Key', () => {
  let app
  const testApiKey = 'test-api-key-user123'

  beforeEach(async () => {
    vi.resetModules()
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
  const testUserId = 'testuser:matrix.org'

  beforeEach(async () => {
    vi.resetModules()
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