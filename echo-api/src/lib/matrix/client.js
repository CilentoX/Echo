import { createClient } from 'matrix-js-sdk'

const clients = new Map()

/**
 * Creates or retrieves a cached Matrix client for a given user.
 * @param {string} userId - The Matrix user ID (e.g. "@user:domain")
 * @param {string} accessToken - The user's access token for Synapse
 * @param {string} baseUrl - The Synapse base URL (from SYNAPSE_URL env var)
 * @returns {import('matrix-js-sdk').MatrixClientLike} The Matrix client instance
 */
export function getMatrixClient(userId, accessToken, baseUrl) {
  // If client already exists for this userId, return it from cache
  if (clients.has(userId)) {
    return clients.get(userId)
  }

  const client = createClient({
    baseUrl,
    accessToken,
    userId,
  })

  clients.set(userId, client)
  return client
}

/**
 * Invalidates (removes) a cached Matrix client for a given user.
 * @param {string} userId - The Matrix user ID to invalidate
 */
export function invalidateUser(userId) {
  clients.delete(userId)
}