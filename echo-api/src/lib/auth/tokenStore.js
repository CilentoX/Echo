import crypto from 'crypto'

/**
 * Derives a 256-bit encryption key from the TOKEN_ENCRYPTION_KEY env var.
 * Uses SHA-256 to ensure a fixed-length key regardless of input length.
 */
export function getEncryptionKey() {
  const rawKey = process.env.TOKEN_ENCRYPTION_KEY || ''
  return crypto.createHash('sha256').update(rawKey).digest()
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns the encrypted data as a base64 string with format: iv|ciphertext|tag
 *
 * @param {string} text - The plaintext to encrypt
 * @returns {string} Encrypted data in iv|ciphertext|tag format (base64)
 */
export function encrypt(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const tag = cipher.getAuthTag()

  // tag is a Buffer (16 bytes for AES-GCM); convert to base64
  const tagB64 = tag.toString('base64')
  // iv to base64
  const ivB64 = iv.toString('base64')
  return `${ivB64}|${encrypted}|${tagB64}`
}

/**
 * Decrypt a string encrypted with AES-256-GCM.
 * Expects format: base64(iv)|base64(ciphertext)|base64(tag)
 *
 * @param {string} encrypted - Encrypted data in iv|ciphertext|tag format
 * @returns {string} The decrypted plaintext
 * @throws {Error} If decryption fails (invalid key or corrupted data)
 */
export function decrypt(encrypted) {
  const key = getEncryptionKey()

  const parts = encrypted.split('|')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected: iv|ciphertext|tag')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const ciphertext = parts[1]
  const tag = Buffer.from(parts[2], 'base64')

  const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  cipher.setAuthTag(tag)

  let decrypted = cipher.update(ciphertext, 'base64', 'utf8')
  decrypted += cipher.final('utf8')

  return decrypted
}

/**
 * Store user access and refresh tokens encrypted at rest.
 * Uses Prisma upsert to create or update the UserToken record.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - The Prisma client instance
 * @param {string} userId - The user Matrix ID (e.g. "@user:domain")
 * @param {string} accessToken - The access token to store
 * @param {string} [refreshToken] - The optional refresh token to store
 * @param {string} [deviceId] - The optional device ID
 * @returns {Promise<object>} The upserted UserToken record
 */
export async function storeUserTokensDB(prisma, userId, accessToken, refreshToken = null, deviceId = null) {
  const encryptedAccessToken = encrypt(accessToken)
  const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null

  const result = await prisma.userToken.upsert({
    where: { userId },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      deviceId,
    },
    create: {
      userId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      deviceId,
    },
  })

  return result
}

/**
 * Retrieve and decrypt the access token for a user.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - The Prisma client instance
 * @param {string} userId - The user Matrix ID (e.g. "@user:domain")
 * @returns {Promise<string|null>} The decrypted access token, or null if not found
 */
export async function getUserAccessTokenDB(prisma, userId) {
  const userToken = await prisma.userToken.findUnique({
    where: { userId },
  })

  if (!userToken || !userToken.accessToken) {
    return null
  }

  return decrypt(userToken.accessToken)
}