import 'server-only';
import { kvDel, kvGet, kvIncr } from '@/server/db/kv';
import { sha256 } from '@/server/security/crypto';

/** Ventana fija. Devuelve true si la petición está permitida. Si el almacén falla, deniega. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    return (await kvIncr(`rl/${sha256(key)}-${bucket}`, windowSec)) <= max;
  } catch {
    return false;
  }
}

// Bloqueo por fallos: 5 intentos fallidos en 15 min bloquean esa IP y ese email durante 15 min.
const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60;
const ipKey = (ip: string) => `fail/ip-${sha256(ip)}`;
const emailKey = (email: string) => `fail/em-${sha256(email)}`;

export async function recordLoginFailure(ip: string, email: string): Promise<void> {
  try {
    await Promise.all([kvIncr(ipKey(ip), FAIL_WINDOW), kvIncr(emailKey(email), FAIL_WINDOW)]);
  } catch {
    /* noop */
  }
}

export async function isLockedOut(ip: string, email: string): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([kvGet<number>(ipKey(ip)), kvGet<number>(emailKey(email))]);
    return (a ?? 0) >= FAIL_MAX || (b ?? 0) >= FAIL_MAX;
  } catch {
    return true;
  }
}

export async function clearLoginFailures(ip: string, email: string): Promise<void> {
  await kvDel(ipKey(ip), emailKey(email)).catch(() => undefined);
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
