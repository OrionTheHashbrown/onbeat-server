/**
 * SERVER SETUP – src/server.ts
 *
 * REFERENCE FROM
 * https://fastify.dev/docs/latest/Guides
 * https://github.com/fastify/fastify-swagger
 * https://github.com/fastify/fastify-swagger-ui
 * https://github.com/fastify/fastify-rate-limit
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env, isProduction } from './env.js';
import authPlugin from './plugins/auth.js';
import supabasePlugin from './plugins/supabase.js';
import { healthRoutes } from './routes/health.js';
import { trackRoutes } from './routes/tracks.js';
import { runRoutes } from './routes/runs.js';

export async function buildServer() {
  let logTransport = undefined;
  if (!isProduction) {
    logTransport = {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    };
  }

  const app = Fastify({
    logger: {
      level: env.logLevel,
      transport: logTransport,
      // HIDE the tokens and keys from the logs
      redact: ['req.headers.authorization', 'req.headers["x-rapidapi-key"]'],
    },
  });

  await app.register(cors, { origin: env.corsOrigins });

  // LIMIT to 120 requests per minute
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // API DOCS at /docs, built from the route schemas
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'OnBeat Server API',
        description:
          'Spotify track analysis API for Onbeat via RapidAPI (Soundnet) and Supabase to store user data and track history.',
        version: '2.0.2',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(supabasePlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(trackRoutes);
  await app.register(runRoutes);

  return app;
}
