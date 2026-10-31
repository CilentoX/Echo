import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { encrypt } from '../src/lib/auth/tokenStore.js'
import { setupPrismaClient, authenticate } from '../src/plugins/auth.js'

// Use a valid base64-encoded 32-byte key for tests (openssl rand -base64 32)
const TEST_ENCRYPTION_KEY = 'BqMY9SmbfN4+b2UP8JP2+MpIk/HfSseOX3KTw2Nby+E='

let testAccessToken = ''
let bearerAccessToken = ''

beforeAll(() => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_ENCRYPTION_KEY)
  testAccessToken = encrypt('test-access-token')
  bearerAccessToken = encrypt('bearer-access-token')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('Auth Middleware - X-API-Key', () => {
  let app
  const testApiKey = 'test-api-key-user123'

  beforeEach(async () => {
    app = Fastify({ logger: false })
    setupPrismaClient(app, {
      userToken: {
        findUnique: async (params) => {
          const where = params?.where
          if (where?.userId === testApiKey) {
            return {
              userId: testApiKey,
              accessToken: testAccessToken,
              deviceId: 'test-device-001',
            }
          }
          return null
        },
      },
      $disconnect: async () => {},
      $transaction: async (fn) => fn(),
      $use: () => {},
    })
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

describe('Auth Middleware - Bearer Token', () => {
  let app
  const testUserId = 'dummy-jwt-token'

  beforeEach(async () => {
    app = Fastify({ logger: false })
    setupPrismaClient(app, {
      userToken: {
        findUnique: async (params) => {
          const where = params?.where
          if (where?.userId === testUserId) {
            return {
              userId: testUserId,
              accessToken: bearerAccessToken,
              deviceId: 'test-device-002',
            }
          }
          return null
        },
      },
      $disconnect: async () => {},
      $transaction: async (fn) => fn(),
      $use: () => {},
    })
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
        authorization: `Bearer ${testUserId}`,
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