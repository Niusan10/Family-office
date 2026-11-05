import 'server-only';
import { redis } from '@/server/db/redis';
import { allowedEmails, requireEnv } from '@/env';

/**
 * Whitelist interna. El email debe estar en ALLOWED_EMAILS. En el primer login se ancla el `sub`
 * de Google: si el email se reasigna a otra persona en Workspace, el acceso no se hereda.
 * Para desanclar (p. ej. cuenta recreada): borrar la clave `user:sub:<email>` en Redis.
 */
export async function resolveAllowedUser(p: { email: string; sub: string }) {
  const email = p.email.toLowerCase();
  if (!allowedEmails(requireEnv()).has(email)) return null;

  const key = `user:sub:${email}`;
  const pinned = await redis().get<string>(key);
  if (pinned && pinned !== p.sub) return null;
  if (!pinned) {
    const ok = await redis().set(key, p.sub, { nx: true });
    if (ok !== 'OK' && (await redis().get<string>(key)) !== p.sub) return null;
  }
  return { email, sub: p.sub };
}
