import { NextResponse, type NextRequest } from 'next/server';
import { verifyPreSessionCsrf } from '@/server/auth/csrf';
import { burnTime, verifyPassword } from '@/server/auth/password';
import { clearCookie, createSession, PRE_COOKIE, setSessionCookies } from '@/server/auth/session';
import { getUser, isValidEmail, normalizeEmail } from '@/server/auth/users';
import { clearLoginFailures, clientIp, isLockedOut, rateLimit, recordLoginFailure } from '@/server/security/rate-limit';
import { audit } from '@/server/security/audit';

export const dynamic = 'force-dynamic';

const back = (req: NextRequest, code: string) => NextResponse.redirect(new URL(`/login?e=${code}`, req.url), 303);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`login:${ip}`, 20, 60))) return back(req, '2');

  const form = await req.formData().catch(() => null);
  const email = normalizeEmail(String(form?.get('email') ?? '')).slice(0, 254);
  const password = String(form?.get('password') ?? '').slice(0, 256);

  if (!verifyPreSessionCsrf(req, String(form?.get('csrf') ?? ''))) return back(req, '3');

  if (await isLockedOut(ip, email)) {
    await audit({ event: 'login.locked', email, ip });
    return back(req, '2');
  }

  const user = isValidEmail(email) ? await getUser(email) : null;

  // Siempre se gasta el mismo tiempo, exista o no el email: no se puede saber qué emails están autorizados.
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await burnTime(password), false);

  if (!user || !ok) {
    await recordLoginFailure(ip, email);
    await audit({ event: 'login.denied', email, ip, reason: !user ? 'not_authorized' : !user.passwordHash ? 'not_activated' : 'bad_password' });
    return back(req, '1');
  }

  await clearLoginFailures(ip, email);
  const { sid, session } = await createSession(user.email, req.headers.get('user-agent') ?? '');
  await audit({ event: 'login.ok', email: user.email, ip });

  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303);
  setSessionCookies(res, sid, session);
  clearCookie(res, PRE_COOKIE);
  return res;
}
