// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { Redis } from '@upstash/redis';
import { requireEnv } from '@/env';

// Base de datos compartida con otros proyectos: TODAS las claves de esta app empiezan por "fo:".
let client: Redis | null = null;

export function redis(): Redis {
  if (!client) {
    const env = requireEnv();
    client = new Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
  }
  return client;
}
