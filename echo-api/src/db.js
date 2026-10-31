// Default mock prisma client for testing purposes
// In production, this would be replaced with the real PrismaClient

const mockPrisma = {
  userToken: {
    findUnique: async (where) => {
      // Return mock data based on userId
      if (where.userId === 'test-api-key-user123') {
        return {
          userId: 'test-api-key-user123',
          accessToken: 'encrypted-test-access-token',
          deviceId: 'test-device-001',
        }
      }
      if (where.userId === 'testuser:matrix.org') {
        return {
          userId: 'testuser:matrix.org',
          accessToken: 'encrypted-bearer-token',
          deviceId: 'test-device-002',
        }
      }
      return null
    },
    create: async () => {},
    upsert: async () => {},
    deleteMany: async () => {},
  },
  $disconnect: async () => {},
  $transaction: async (fn) => fn(),
  $use: () => {},
}

export default mockPrisma