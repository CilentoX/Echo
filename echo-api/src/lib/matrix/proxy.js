import { undici } from 'undici'
import { URL } from 'url'

/**
 * Generic HTTP proxy that forwards requests to Synapse with auth injection.
 * 
 * @param {object} request - Fastify request object (expected to have `user.accessToken`)
 * @param {object} reply - Fastify reply object
 * @param {string} matrixPath - The Matrix/Synapse path to forward to
 * @returns {Promise<void>} Resolves when the proxy operation completes
 */
export async function proxyToMatrix(request, reply, matrixPath) {
  const baseUrl = process.env.SYNAPSE_URL || 'http://echo-postgres:8008'
  const accessToken = request.user?.accessToken

  if (!accessToken) {
    reply.code(401).send({ error: 'Unauthorized: no access token' })
    return
  }

  const options = {
    method: request.method,
    path: matrixPath,
    hostname: new URL(baseUrl).hostname,
    port: new URL(baseUrl).port,
    headers: {},
    body: request.body,
  }

  // Copy relevant headers from the request, excluding host
  for (const [key, value] of Object.entries(request.headers)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'authorization') {
      options.headers.authorization = `Bearer ${accessToken}`
    } else if (lowerKey === 'content-type' || lowerKey === 'accept') {
      options.headers[lowerKey] = value
    }
  }
  // Inject authorization header if not already present
  if (!options.headers.authorization) {
    options.headers.authorization = `Bearer ${accessToken}`
  }

  try {
    const { request: undiciRequest, abortController } = await undici.request(options)

    // Handle the response
    const handleResponse = (undiciResponse) => {
      const statusCode = undiciResponse.statusCode
      const responseHeaders = {}

      for (const [key, value] of Object.entries(undiciResponse.headers)) {
        responseHeaders[key] = value
      }

      reply.statusCode(statusCode).headers(responseHeaders).send(undiciResponse.body)
    }

    undiciRequest.on('response', handleResponse)

    // Handle streaming for /sync
    if (matrixPath.includes('/sync')) {
      undiciResponse.body.pipeTo
        ? undiciResponse.body.pipeTo(reply)
        : undiciResponse.body.on('data', chunk => {
            reply.send(chunk)
          })
    }

    // Pipe request body if present
    if (request.body) {
      undiciRequest.write(request.body)
    }

    // Wait for the response to complete
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Proxy timeout')), 30000)
      undiciRequest.on('end', resolve)
      undiciRequest.on('error', reject)
      abortController?.abort
    })
  } catch (error) {
    reply.code(502).send({ error: 'Proxy error', details: error.message })
  }
}