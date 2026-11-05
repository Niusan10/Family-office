// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { redis } from '@/server/db/redis';
import { getEnv } from '@/env';

/** Ventana fija en Redis. Devuelve true si la petición está permitida. Si Redis falla, deniega. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const k = `rl:${key}:${bucket}`;
    const [count] = await redis().pipeline().incr(k).expire(k, windowSec).exec<[number, number]>();
    return count <= max;
  } catch {
    return false;
  }
}

const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60;

export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    const k = `fail:${ip}`;
    await redis().pipeline().incr(k).expire(k, FAIL_WINDOW).exec();
  } catch {
    /* noop */
  }
}

export async function isLockedOut(ip: string): Promise<boolean> {
  try {
    const n = (await redis().get<number>(`fail:${ip}`)) ?? 0;
    return n >= FAIL_MAX;
  } catch {
    return true;
  }
}

export function clientIp(req: Request): string {
  const h = req.headers;
  if (getEnv()?.CF_ACCESS_AUD) {
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf;
  }
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
