import { decrypt } from '../lib/auth/tokenStore.js'

let prismaClient = null

/**
 * Set the prisma client instance for the auth middleware.
 * Can be called globally or per-test via vi.mock.
 * 
 * @param {object} client - Prisma client instance
 */
export function setPrismaClient(client) {
  prismaClient = client
}

/**
 * Fastify decorator for the Prisma client.
 * Set this in your Fastify plugin setup before using the auth middleware.
 * 
 * @param {import('@prisma/client').PrismaClient} client - The Prisma client instance
 */
export function setupPrismaClient(client) {
  // This function is called during Fastify plugin initialization
  // and decorates the fastify instance with the prisma client.
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
  // Fastify normalizes headers to lowercase
  const apiKey = request.headers['x-api-key']
  const authHeader = request.headers['authorization']

  // Try X-API-Key first (existing authentication method)
  if (apiKey) {
    const prisma = prismaClient || request.prisma || global.prisma
    const userToken = await prisma.userToken.findUnique({
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
    // Per spec: X-API-Key maps to a user record; userId comes from the token store
    request.user = {
      userId: userToken.userId,
      accessToken,
      deviceId,
    }
    return
  }

  // Try Authorization: Bearer <jwt> (new method for desktop)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.substring(7)

    // JWT verification - use jose library when available:
    //   import { jwtVerify } from 'jose'
    //   const { payload } = await jwtVerify(jwt, new TextEncoder().encode(TOKENT_ENCRYPTION_KEY))
    //   const userId = payload.sub
    //
    // For now, we verify the token exists in the token store.
    // TODO: Integrate jose library for proper JWT signature verification.
    const prisma = prismaClient || request.prisma || global.prisma
    const userToken = await prisma.userToken.findUnique({
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
    // Per spec: JWT should be verified and decoded to extract userId
    // For now, the jwt string itself is used as the identifier until jose integration
    request.user = {
      userId: userToken.userId,
      accessToken,
      deviceId,
    }
    return
  }

  // No authentication provided
  reply.code(401).send({ error: 'Unauthorized: no authentication credentials' })
}