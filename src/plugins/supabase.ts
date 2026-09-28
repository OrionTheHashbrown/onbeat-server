/**
 * SUPABASE CLIENTS – src/plugins/supabase.ts
 *
 * REFERENCE FROM
 * https://supabase.com/docs/reference/javascript/initializing
 * https://supabase.com/docs/guides/api/api-keys
 * https://fastify.dev/docs/latest/Reference/Decorators/
 * https://github.com/fastify/fastify-plugin
 */

import fp from 'fastify-plugin';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

const serverOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

declare module 'fastify' {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient;
  }
  interface FastifyRequest {
    supabaseAsUser: () => SupabaseClient;
  }
}

async function supabasePlugin(fastify: FastifyInstance) {
  // ONE admin client for the whole server, it holds no user data
  const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, serverOptions);

  fastify.decorate('supabaseAdmin', supabaseAdmin);

  // NEW client for every request, it holds the user data from the token
  fastify.decorateRequest('supabaseAsUser', function () {
    const token = this.accessToken;
    if (!token) {
      throw new Error(
        '[supabase.ts] supabaseAsUser() needs a verified token. Did the route forget preHandler: [fastify.authenticate]?',
      );
    }

    return createClient(env.supabaseUrl, env.supabaseAnonKey, {
      ...serverOptions,
      global: {
        headers: { Authorization: 'Bearer ' + token },
      },
    });
  });
}

export default fp(supabasePlugin, { name: 'supabase' });
