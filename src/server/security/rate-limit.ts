import 'server-only';
import { redis } from '@/server/db/redis';
import { sha256 } from '@/server/security/crypto';

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

// Bloqueo por fallos: 5 intentos fallidos en 15 min bloquean esa IP y ese email durante 15 min.
const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60;
const ipKey = (ip: string) => `fail:ip:${ip}`;
const emailKey = (email: string) => `fail:em:${sha256(email)}`;

export async function recordLoginFailure(ip: string, email: string): Promise<void> {
  try {
    await redis()
      .pipeline()
      .incr(ipKey(ip))
      .expire(ipKey(ip), FAIL_WINDOW)
      .incr(emailKey(email))
      .expire(emailKey(email), FAIL_WINDOW)
      .exec();
  } catch {
    /* noop */
  }
}

export async function isLockedOut(ip: string, email: string): Promise<boolean> {
  try {
    const [a, b] = await redis().mget<(number | null)[]>(ipKey(ip), emailKey(email));
    return (a ?? 0) >= FAIL_MAX || (b ?? 0) >= FAIL_MAX;
  } catch {
    return true;
  }
}

export async function clearLoginFailures(ip: string, email: string): Promise<void> {
  try {
    await redis().del(ipKey(ip), emailKey(email));
  } catch {
    /* noop */
  }
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
