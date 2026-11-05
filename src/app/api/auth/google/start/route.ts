import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { buildAuthUrl } from '@/server/auth/google-oidc';
import { OAUTH_COOKIE } from '@/server/auth/session';
import { randomToken, seal } from '@/server/security/crypto';
import { clientIp, isLockedOut, rateLimit } from '@/server/security/rate-limit';
import { audit } from '@/server/security/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`auth:start:${ip}`, 10, 60))) return new NextResponse(null, { status: 429 });
  if (await isLockedOut(ip)) {
    await audit({ event: 'auth.locked_out', ip });
    return NextResponse.redirect(new URL('/login?e=1', req.url), 303);
  }

  const state = randomToken(32);
  const nonce = randomToken(32);
  const codeVerifier = randomToken(32);
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const res = NextResponse.redirect(buildAuthUrl({ state, nonce, codeChallenge }), 303);
  // Lax (no Strict): debe viajar en la vuelta cross-site desde accounts.google.com
  res.cookies.set({
    name: OAUTH_COOKIE,
    value: seal({ state, nonce, codeVerifier }, 600),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
