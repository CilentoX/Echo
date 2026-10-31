import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt, storeUserTokensDB, getUserAccessTokenDB } from '../src/lib/auth/tokenStore.js'

describe('Token Store - Encryption', () => {
  const testKey = process.env.TOKEN_ENCRYPTION_KEY || 'test-key-for-development-must-be-long-enough'
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY

  beforeEach(() => {
    // Set a known key for deterministic testing
    process.env.TOKEN_ENCRYPTION_KEY = testKey
  })

  afterEach(() => {
    if (originalKey) {
      process.env.TOKEN_ENCRYPTION_KEY = originalKey
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY
    }
  })

  describe('encrypt', () => {
    it('should encrypt a string to base64 format with iv|ciphertext|tag structure', () => {
      const text = 'hello world'
      const encrypted = encrypt(text)
      // Should contain the pipe separator format
      const parts = encrypted.split('|')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64 iv
      expect(parts[1]).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64 ciphertext
      expect(parts[2]).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64 tag
    })

    it('should decrypt encrypted text back to original', () => {
      const text = 'test payload for encryption'
      const encrypted = encrypt(text)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(text)
    })

    it('should produce different ciphertext for same input due to random IV', () => {
      const text = 'same text different time'
      const encrypted1 = encrypt(text)
      const encrypted2 = encrypt(text)
      expect(encrypted1).not.toBe(encrypted2)
      // But both should decrypt to the same text
      expect(decrypt(encrypted1)).toBe(text)
      expect(decrypt(encrypted2)).toBe(text)
    })
  })

  describe('storeUserTokensDB', () => {
    it('should be a function', () => {
      expect(storeUserTokensDB).toBeDefined()
      expect(typeof storeUserTokensDB).toBe('function')
    })
  })

  describe('getUserAccessTokenDB', () => {
    it('should be a function', () => {
      expect(getUserAccessTokenDB).toBeDefined()
      expect(typeof getUserAccessTokenDB).toBe('function')
    })
  })
})