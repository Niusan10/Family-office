// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { z } from 'zod';

const schema = z.object({
  APP_HOST: z.string().min(1),
  APP_ORIGIN: z.string().min(1),
  ADMIN_EMAIL: z.string().email().transform((s) => s.trim().toLowerCase()),
  SETUP_TOKEN: z.string().min(32),
  REDIS_URL: z.string().min(1),
  REDIS_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Configuración validada en tiempo de ejecución. Si falta algo devuelve null
 * y el proxy responde 503 a todo: falla cerrada.
 */
export function getEnv(): Env | null {
  if (cached) return cached;
  const parsed = schema.safeParse({
    APP_HOST: process.env.APP_HOST,
    APP_ORIGIN: process.env.APP_ORIGIN,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    SETUP_TOKEN: process.env.SETUP_TOKEN,
    REDIS_URL: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
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
