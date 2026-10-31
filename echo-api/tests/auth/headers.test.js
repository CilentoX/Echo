import { it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

it('check headers', async () => {
  const app = Fastify({ logger: false })
  app.post('/test', async (request, reply) => {
    // Log all headers
    const headerKeys = Object.keys(request.headers)
    console.log('All header keys:', headerKeys)
    console.log('x-api-key value:', request.headers['x-api-key'])
    console.log('X-API-Key value:', request.headers['X-API-Key'])
    console.log('authorization value:', request.headers['authorization'])
    return { headers: headerKeys }
  })
  const response = await app.inject({
    method: 'POST',
    url: '/test',
    headers: {
      'x-api-key': 'test-api-key-user123',
      authorization: 'Bearer dummy-token',
    },
  })
  console.log('Response status:', response.statusCode)
  await app.close()
})