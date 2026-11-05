import { NextResponse, type NextRequest } from 'next/server';
import { clearCookie, CSRF_COOKIE, readSession, revokeFamily, SESSION_COOKIE } from '@/server/auth/session';
import { verifyCsrfToken } from '@/server/auth/csrf';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

// El proxy ya ha validado sesión y Origin. Aquí se comprueba el token CSRF del formulario.
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const form = await req.formData().catch(() => null);
  if (!session || !verifyCsrfToken(String(form?.get('csrf') ?? ''), session)) {
    return new NextResponse(null, { status: 403 });
  }
  await revokeFamily(session.family);
  await audit({ event: 'logout', email: session.email, ip: clientIp(req) });

  const res = NextResponse.redirect(new URL('/login?e=out', req.url), 303);
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, CSRF_COOKIE);
  return res;
}
