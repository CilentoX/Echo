import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

describe('Header debug', () => {
  it('test headers', async () => {
    const app = Fastify({ logger: false })
    app.post('/test', async (request, reply) => {
      console.log('Headers:', request.headers)
      console.log('x-api-key:', request.headers['x-api-key'])
      return { ok: true }
    })
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        'x-api-key': 'test-api-key-user123',
      },
    })
    console.log('Response:', response.statusCode, response.json())
    await app.close()
  })
})