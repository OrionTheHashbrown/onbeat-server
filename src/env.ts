/**
 * ENVIRONMENT VARIABLES – src/env.ts
 *
 * REFERENCE FROM
 * https://nodejs.org/api/cli.html#--env-fileconfig
 * https://supabase.com/docs/guides/api/api-keys
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error('[env.ts] ' + name + ' is MISSING from .env');
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return value;
}

// SPLIT "a, b ,c" into ['a', 'b', 'c'] and SKIP any empty ones
function readCorsOrigins(): string[] {
  const origins: string[] = [];
  for (const origin of optionalEnv('CORS_ORIGINS', 'http://localhost:3000').split(',')) {
    const trimmedOrigin = origin.trim();
    if (trimmedOrigin.length > 0) {
      origins.push(trimmedOrigin);
    }
  }
  return origins;
}

export const env = {
  port: Number(optionalEnv('PORT', '3000')),
  host: optionalEnv('HOST', '0.0.0.0'),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  corsOrigins: readCorsOrigins(),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  rapidapiKey: requireEnv('RAPIDAPI_KEY'),
  rapidapiHost: optionalEnv('RAPIDAPI_HOST', 'track-analysis.p.rapidapi.com'),
  soundnetChunkSize: Number(optionalEnv('SOUNDNET_CHUNK_SIZE', '3')),
} as const;

export const isProduction = env.nodeEnv === 'production';
