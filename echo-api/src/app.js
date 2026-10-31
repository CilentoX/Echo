import Fastify from 'fastify'
import { proxyToMatrix } from '../lib/matrix/proxy.js'

const app = Fastify({ logger: true })

/**
 * Matrix proxy route - forwards all /matrix/* requests to Synapse
 * 
 * This route requires authentication - the request must have `request.user.accessToken`
 * set by the auth middleware (Task 2).
 * 
 * @param {string} matrixPath - The Matrix/Synapse path (e.g., `_matrix/client/v3/rooms`)
 * @returns {void}
 */
app.route({
  method: ['GET', 'POST', 'PUT', 'DELETE'],
  url: '/matrix/:matrixPath*',
  handler: async (request, reply) => {
    // Auth check - ensure user has access token
    if (!request.user || !request.user.accessToken) {
      reply.code(401).send({ error: 'Unauthorized: no access token' })
      return
    }

    await proxyToMatrix(request, reply, request.params.matrixPath)
  },
})

export default app