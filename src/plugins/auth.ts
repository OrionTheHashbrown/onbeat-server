/**
 * AUTHENTICATION – src/plugins/auth.ts
 *
 * REFERENCE FROM
 * https://supabase.com/docs/reference/javascript/auth-getclaims
 * https://supabase.com/docs/guides/auth/signing-keys
 * https://fastify.dev/docs/latest/Reference/Decorators/
 * https://fastify.dev/docs/latest/Reference/Hooks/#prehandler
 * https://github.com/fastify/fastify-plugin
 */

import fp from 'fastify-plugin';
import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthenticatedUser | null;
    accessToken: string | null;
  }
}

const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function authPlugin(fastify: FastifyInstance) {
  // START every request with null, so request.user is null (not undefined) on open routes
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('accessToken', null);
  fastify.decorate('authenticate', async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;

    // CHECK there is a Bearer token at all
    if (!header || !header.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'missing_token',
        message: 'UNAUTHORIZED. Please check the Auth header and try again.',
      });
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const { data, error } = await authClient.auth.getClaims(token);

      // CHECK the token is valid and has a user id (sub)
      if (error || !data?.claims?.sub) {
        let reason = 'no sub claim';
        if (error) {
          reason = error.message;
        }
        request.log.warn({ reason }, '[auth.ts] rejected a token');
        return reply.code(401).send({
          error: 'invalid_token',
          message: 'That Supabase session is not valid. Sign in again.',
        });
      }

      // EMAIL can be missing (e.g. phone sign in), so ALWAYS use sub as the user id
      let email: string | null = null;
      if (typeof data.claims.email === 'string') {
        email = data.claims.email;
      }

      request.user = { id: data.claims.sub, email };

      // SAVE the token 
      request.accessToken = token;
    } catch (error) {
      request.log.error({ err: String(error) }, '[auth.ts] could not verify the token');
      return reply.code(503).send({
        error: 'auth_unavailable',
        message: 'Could not reach Supabase to verify the session. Try again shortly.',
      });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
