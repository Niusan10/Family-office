// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { z } from 'zod';

const schema = z.object({
  APP_HOST: z.string().min(1),
  APP_ORIGIN: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_HD: z.string().min(3).transform((s) => s.trim().toLowerCase()),
  ALLOWED_EMAILS: z.string().min(3),
  SEAL_KEY: z.string().min(40),
  REDIS_URL: z.string().min(1),
  REDIS_TOKEN: z.string().min(1),
  CF_TEAM_DOMAIN: z.string().optional(),
  CF_ACCESS_AUD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Configuración validada. Se lee en tiempo de ejecución (no en build) y devuelve null
 * si falta algo: el proxy responde entonces 503 a todo. Falla cerrada.
 */
export function getEnv(): Env | null {
  if (cached) return cached;
  const parsed = schema.safeParse({
    APP_HOST: process.env.APP_HOST,
    APP_ORIGIN: process.env.APP_ORIGIN,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ALLOWED_HD: process.env.ALLOWED_HD,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    SEAL_KEY: process.env.SEAL_KEY,
    REDIS_URL: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
    CF_TEAM_DOMAIN: process.env.CF_TEAM_DOMAIN || undefined,
    CF_ACCESS_AUD: process.env.CF_ACCESS_AUD || undefined,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    console.error(JSON.stringify({ event: 'config.invalid', missing }));
    return null;
  }
  cached = parsed.data;
  return cached;
}

export function requireEnv(): Env {
  const env = getEnv();
  if (!env) throw new Error('config_invalid');
  return env;
}

export const allowedEmails = (env: Env) =>
  new Set(env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
