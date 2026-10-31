import { decrypt } from '../lib/auth/tokenStore.js'
import { jwtVerify } from 'jose'

/**
 * Fastify plugin that sets up the Prisma client decorator.
 * 
 * @param {import('@prisma/client').PrismaClient} client - The Prisma client instance
 * @param {import('fastify').FastifyInstance} app - The Fastify instance
 */
export function setupPrismaClient(app, client) {
  app.decorateRequest('prisma', () => client)
}

/**
 * Resolves a user from the token store by userId.
 * Extracts common logic from both X-API-Key and Bearer branches.
 * 
 * @param {import('@prisma/client').PrismaClient} prisma - The Prisma client instance
 * @param {string} userId - The user identifier (API key or JWT sub)
 * @returns {Promise<object|null>} User token data or null
 */
async function resolveUser(prisma, userId) {
  const userToken = await prisma.userToken.findUnique({
    where: { userId },
  })

  if (!userToken || !userToken.accessToken) {
    return null
  }

  try {
    const accessToken = decrypt(userToken.accessToken)
    const deviceId = userToken.deviceId

    return { userToken, accessToken, deviceId }
  } catch (error) {
    // Decryption failed - invalid key or corrupted data
    return null
  }
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
    const prisma = request.prisma()
    const userData = await resolveUser(prisma, apiKey)

    if (!userData) {
      reply.code(401).send({ error: 'Unauthorized: invalid API key' })
      return
    }

    // Populate request.user
    // Per spec: X-API-Key maps to a user record via the token store
    request.user = {
      userId: userData.userToken.userId,
      accessToken: userData.accessToken,
      deviceId: userData.deviceId,
    }
    return
  }

  // Try Authorization: Bearer <jwt> (new method for desktop)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.substring(7)

    // JWT verification with jose library
    const prisma = request.prisma()
    let userData = null
    let userId = null

    try {
      // Decode TOKEN_ENCRYPTION_KEY from base64 to get the secret
      const secretKey = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'base64')
      const { payload } = await jwtVerify(jwt, secretKey)
      userId = payload.sub
    } catch (error) {
      // Invalid JWT - fall back to token store lookup (legacy)
      userId = jwt
    }

    userData = await resolveUser(prisma, userId)

    if (!userData) {
      reply.code(401).send({ error: 'Unauthorized: invalid bearer token' })
      return
    }

    // Populate request.user
    // Per spec: JWT should be verified and decoded to extract userId
    request.user = {
      userId: userData.userToken.userId,
      accessToken: userData.accessToken,
      deviceId: userData.deviceId,
    }
    return
  }

  // No authentication provided
  reply.code(401).send({ error: 'Unauthorized: no authentication credentials' })
}