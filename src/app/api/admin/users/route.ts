import { NextResponse, type NextRequest } from 'next/server';
import { readSession, revokeAllForUser, SESSION_COOKIE } from '@/server/auth/session';
import { verifyCsrfToken } from '@/server/auth/csrf';
import { addUser, createInvite, getUser, isValidEmail, normalizeEmail, removeUser, type Role } from '@/server/auth/users';
import { redis } from '@/server/db/redis';
import { requireEnv } from '@/env';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

import type { Flash } from '@/server/ui/flash';

/** Gestión de emails autorizados. Solo administradores, con sesión, Origin (proxy) y token CSRF. */
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const actor = session ? await getUser(session.email) : null;
  const form = await req.formData().catch(() => null);
  if (!session || !actor || actor.role !== 'admin' || !verifyCsrfToken(String(form?.get('csrf') ?? ''), session)) {
    return new NextResponse(null, { status: 404 });
  }

  const action = String(form?.get('action') ?? '');
  const email = normalizeEmail(String(form?.get('email') ?? ''));
  const ip = clientIp(req);
  const origin = requireEnv().APP_ORIGIN;
  let flash: Flash;

  if (!isValidEmail(email)) {
    flash = { kind: 'err', text: 'Ese email no es válido.' };
  } else if (action === 'add') {
    const role: Role = form?.get('role') === 'admin' ? 'admin' : 'miembro';
    if ((await addUser(email, role, actor.email)) === 'exists') {
      flash = { kind: 'err', text: `${email} ya está autorizado.` };
    } else {
      const link = `${origin}/activar?t=${await createInvite(email)}`;
      await audit({ event: 'user.added', email, by: actor.email, ip, reason: role });
      flash = { kind: 'ok', text: `${email} autorizado. Envíale este enlace para que cree su contraseña (caduca en 72 h y solo sirve una vez):`, link };
    }
  } else if (action === 'invite') {
    if (!(await getUser(email))) {
      flash = { kind: 'err', text: `${email} no está autorizado.` };
    } else {
      const link = `${origin}/activar?t=${await createInvite(email)}`;
      await audit({ event: 'user.invite', email, by: actor.email, ip });
      flash = { kind: 'ok', text: `Enlace nuevo para ${email} (caduca en 72 h y solo sirve una vez):`, link };
    }
  } else if (action === 'remove') {
    if (email === actor.email) {
      flash = { kind: 'err', text: 'No puedes quitarte el acceso a ti mismo.' };
    } else {
      await removeUser(email);
      await revokeAllForUser(email); // le echa de cualquier sesión abierta al instante
      await audit({ event: 'user.removed', email, by: actor.email, ip });
      flash = { kind: 'ok', text: `${email} ya no tiene acceso.` };
    }
  } else {
    flash = { kind: 'err', text: 'Acción no válida.' };
  }

  // El mensaje (y el enlace, si lo hay) se muestra una sola vez y no viaja en la URL.
  await redis().set(`fo:flash:${session.family}`, flash, { ex: 600 });
  return NextResponse.redirect(new URL('/admin/usuarios', req.url), 303);
}
