import { setPrismaClient, authenticate } from '../src/plugins/auth.js'

console.log('About to call setPrismaClient')
setPrismaClient({
  userToken: {
    findUnique: async (where) => {
      console.log('findUnique called with userId:', where?.userId)
      if (where?.userId === 'test-api-key-user123') {
        return {
          userId: 'test-api-key-user123',
          accessToken: 'encrypted-test-access-token',
          deviceId: 'test-device-001',
        }
      }
      return null
    },
  },
})

console.log('setPrismaClient done')

// Now import authenticate - this should use the set prismaClient
import { authenticate } from '../src/plugins/auth.js' // eslint-disable-line no-unused-vars

console.log('About to test authenticate')

// Can't really test here without Fastify, but let's check if the module system works