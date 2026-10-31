// Setup file - runs before tests
// Set up mock prisma client for auth middleware
import { setPrismaClient } from '../src/plugins/auth.js'

const mockPrisma = {
  userToken: {
    findUnique: async (where) => {
      console.log('Setup findUnique called with userId:', where?.userId)
      if (where?.userId === 'test-api-key-user123') {
        return {
          userId: 'test-api-key-user123',
          accessToken: 'encrypted-test-access-token',
          deviceId: 'test-device-001',
        }
      }
      if (where?.userId === 'testuser:matrix.org') {
        return {
          userId: 'testuser:matrix.org',
          accessToken: 'encrypted-bearer-token',
          deviceId: 'test-device-002',
        }
      }
      return null
    },
  },
  $disconnect: async () => {},
  $transaction: async (fn) => fn(),
  $use: () => {},
}

// Set the prisma client globally for all tests
setPrismaClient(mockPrisma)

export default mockPrisma