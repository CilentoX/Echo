import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setPrismaClient } from '../src/plugins/auth.js'

vi.mock('../src/db.js', async () => {
  console.log('vi.mock called for db.js')
  return {
    default: {
      userToken: {
        findUnique: async (where) => {
          console.log('mock findUnique called with:', JSON.stringify(where))
          if (where.userId === 'test-api-key-user123') {
            return { userId: 'test', accessToken: 'token', deviceId: 'device' }
          }
          return null
        }
      },
    },
  }
})

describe('Debug mock', () => {
  beforeEach(() => {
    setPrismaClient({
      userToken: {
        findUnique: async (where) => {
          console.log('setPrismaClient findUnique called with:', JSON.stringify(where))
        },
      },
    })
  })

  it('test', () => {
    console.log('test running')
  })
})