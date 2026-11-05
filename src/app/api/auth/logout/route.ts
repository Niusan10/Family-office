import { NextResponse, type NextRequest } from 'next/server';
import { clearCookie, CSRF_COOKIE, readSession, revokeFamily, SESSION_COOKIE } from '@/server/auth/session';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

// El proxy ya ha validado sesión, Origin y CSRF antes de llegar aquí.
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    await revokeFamily(session.family);
    await audit({ event: 'logout', email: session.email, ip: clientIp(req) });
  }
  const res = new NextResponse(null, { status: 204 });
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, CSRF_COOKIE);
  return res;
}
