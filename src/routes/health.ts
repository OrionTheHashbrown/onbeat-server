/**
 * HEALTH CHECK – GET /health
 *
 *
 * REFERENCE FROM
 * https://fastify.dev/docs/latest/Guides/Getting-Started/
 * https://fastify.dev/docs/latest/Reference/Routes/
 */

import type { FastifyInstance } from 'fastify';

const healthSchema = {
  tags: ['health'],
  summary: 'HEALTH CHECK – GET /health',
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        uptimeSeconds: { type: 'number' },
      },
    },
  },
} as const;

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', { schema: healthSchema }, async () => {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  });
}
