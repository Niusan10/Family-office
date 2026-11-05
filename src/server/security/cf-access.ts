// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '@/env';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Verifica el JWT de Cloudflare Access. Sin él, quien llegue por *.vercel.app se saltaría el perímetro. */
export async function verifyCloudflareAccess(req: Request, env: Env): Promise<boolean> {
  if (!env.CF_ACCESS_AUD || !env.CF_TEAM_DOMAIN) return false;
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token) return false;
  jwks ??= createRemoteJWKSet(new URL(`https://${env.CF_TEAM_DOMAIN}/cdn-cgi/access/certs`));
  try {
    await jwtVerify(token, jwks, {
      issuer: `https://${env.CF_TEAM_DOMAIN}`,
      audience: env.CF_ACCESS_AUD,
    });
    return true;
  } catch {
    return false;
  }
}
