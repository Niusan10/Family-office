import { NextResponse, type NextRequest } from 'next/server';
import { AuthError, exchangeCode, verifyGoogleIdentity } from '@/server/auth/google-oidc';
import { resolveAllowedUser } from '@/server/auth/allowlist';
import { clearCookie, createSession, OAUTH_COOKIE, setSessionCookies } from '@/server/auth/session';
import { safeEqual, unseal } from '@/server/security/crypto';
import { clientIp, rateLimit, recordLoginFailure } from '@/server/security/rate-limit';
import { audit } from '@/server/security/audit';

export const dynamic = 'force-dynamic';

type OAuthTx = { state: string; nonce: string; codeVerifier: string };

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`auth:cb:${ip}`, 10, 300))) return fail(req, ip, 'rate_limited');

  const tx = unseal<OAuthTx>(req.cookies.get(OAUTH_COOKIE)?.value);
  const q = req.nextUrl.searchParams;
  const state = q.get('state') ?? '';
  const code = q.get('code');

  if (!tx) return fail(req, ip, 'no_tx');
  if (q.get('error')) return fail(req, ip, `google_${q.get('error')}`);
  if (!code || !safeEqual(state, tx.state)) return fail(req, ip, 'state_mismatch');

  try {
    const idToken = await exchangeCode(code, tx.codeVerifier);
    const claims = await verifyGoogleIdentity(idToken, tx.nonce);
    const user = await resolveAllowedUser({ email: claims.email!, sub: claims.sub });
    if (!user) return fail(req, ip, 'not_in_allowlist', claims.email);

    const { sid, session } = await createSession(user, req.headers.get('user-agent') ?? '');
    await audit({ event: 'login.ok', email: user.email, ip });

    const res = bridge('/dashboard');
    setSessionCookies(res, sid, session);
    clearCookie(res, OAUTH_COOKIE, 'lax');
    return res;
  } catch (e) {
    return fail(req, ip, e instanceof AuthError ? e.message : 'verify_error');
  }
}

/** Misma respuesta para cualquier fallo: no revela si falló el dominio, la whitelist o el token. */
async function fail(req: NextRequest, ip: string, reason: string, email?: string) {
  await audit({ event: 'login.denied', reason, email, ip });
  await recordLoginFailure(ip);
  const res = NextResponse.redirect(new URL('/login?e=1', req.url), 303);
  clearCookie(res, OAUTH_COOKIE, 'lax');
  return res;
}

/**
 * Página puente. Esta respuesta pertenece a una navegación iniciada en accounts.google.com
 * (cross-site), así que un 302 directo llegaría sin la cookie Strict recién creada.
 * El meta refresh lanza una navegación nueva desde nuestro propio sitio.
 */
function bridge(to: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0;url=${to}"><title>Acceso</title></head><body></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
