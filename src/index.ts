/**
 * START THE FASTIFY SERVER – src/index.ts
 *
 * REFERENCE FROM
 * https://fastify.dev/docs/latest/Guides/Getting-Started
 */

import { buildServer } from './server.js';
import { env } from './env.js';

const app = await buildServer();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info('[index.ts] ' + signal + ' received, shutting down');
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: env.port, host: env.host });
