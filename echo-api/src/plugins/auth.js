import { decrypt } from '../lib/auth/tokenStore.js'

let prismaClient = null

/**
 * Set the prisma client instance for the auth middleware.
 * Used by the Fastify plugin setup and can be replaced in tests.
 *
 * @param {object} client - Prisma client instance
 */
export function setPrismaClient(client) {
  prismaClient = client
}

/**
 * Extended auth middleware that supports both:
 * 1. X-API-Key header (existing - for server-side)
 * 2. Authorization: Bearer <jwt> (new - for desktop clients)
 *
 * On success, populates request.user with { userId, accessToken, deviceId }
 * from the encrypted token store.
 *
 * @param {object} request - Fastify request object
 * @param {object} reply - Fastify reply object
 * @returns {Promise<void>} Returns 401 if authentication fails, continues if successful
 */
export async function authenticate(request, reply) {
  // Try X-API-Key first (existing authentication method)
  const apiKey = request.headers['x-api-key']
  const authHeader = request.headers['authorization']

  // Try X-API-Key first (existing authentication method)
  if (apiKey) {
    const userToken = await (prismaClient || {}).userToken.findUnique({
      where: { userId: apiKey },
    })

    if (!userToken || !userToken.accessToken) {
      reply.code(401).send({ error: 'Unauthorized: invalid API key' })
      return
    }

    // Decrypt the access token
    const accessToken = decrypt(userToken.accessToken)
    const deviceId = userToken.deviceId

    // Populate request.user
    request.user = {
      userId: apiKey,
      accessToken,
      deviceId,
    }
    return
  }

  // Try Authorization: Bearer <jwt> (new method for desktop)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.substring(7)

    const userToken = await (prismaClient || {}).userToken.findUnique({
      where: { userId: jwt },
    })

    if (!userToken || !userToken.accessToken) {
      reply.code(401).send({ error: 'Unauthorized: invalid bearer token' })
      return
    }

    // Decrypt the access token
    const accessToken = decrypt(userToken.accessToken)
    const deviceId = userToken.deviceId

    // Populate request.user
    request.user = {
      userId: jwt,
      accessToken,
      deviceId,
    }
    return
  }

  // No authentication provided
  reply.code(401).send({ error: 'Unauthorized: no authentication credentials' })
}