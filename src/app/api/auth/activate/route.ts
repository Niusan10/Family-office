import { NextResponse, type NextRequest } from 'next/server';
import { verifyPreSessionCsrf } from '@/server/auth/csrf';
import { hashPassword, passwordProblem } from '@/server/auth/password';
import { clearCookie, PRE_COOKIE, revokeAllForUser } from '@/server/auth/session';
import { consumeInvite, peekInvite, setPassword } from '@/server/auth/users';
import { clientIp, rateLimit } from '@/server/security/rate-limit';
import { audit } from '@/server/security/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('t') ?? '').slice(0, 200);
  const password = String(form?.get('password') ?? '');
  const confirm = String(form?.get('confirm') ?? '');

  const again = (code: string) =>
    NextResponse.redirect(new URL(`/activar?t=${encodeURIComponent(token)}&e=${code}`, req.url), 303);

  if (!(await rateLimit(`activate:${ip}`, 10, 600))) return again('csrf');
  if (!verifyPreSessionCsrf(req, String(form?.get('csrf') ?? ''))) return again('csrf');

  // Se valida la contraseña ANTES de consumir el enlace, para no gastarlo con un error de tecleo.
  if (!(await peekInvite(token))) return again('x');
  if (passwordProblem(password)) return again('short');
  if (password !== confirm) return again('match');

  const email = await consumeInvite(token);
  if (!email) return again('x');

  await setPassword(email, await hashPassword(password));
  await revokeAllForUser(email); // un cambio de contraseña cierra cualquier sesión abierta
  await audit({ event: 'password.set', email, ip });

  const res = NextResponse.redirect(new URL('/login?e=ok', req.url), 303);
  clearCookie(res, PRE_COOKIE);
  return res;
}
