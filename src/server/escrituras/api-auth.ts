import 'server-only';
import type { NextRequest } from 'next/server';
import { verifyCsrfHeader } from '@/server/auth/csrf';
import { readSession, SESSION_COOKIE, type SessionRecord } from '@/server/auth/session';
import { getUser, type User } from '@/server/auth/users';

/**
 * Para las llamadas fetch de la sección Escrituras: sesión válida, usuario autorizado y token CSRF
 * en cabecera (el proxy ya ha comprobado el Origin). Con admin, además, solo administradores.
 */
export async function apiActor(req: NextRequest, opts: { admin?: boolean; csrf?: boolean } = {}): Promise<{ session: SessionRecord; user: User } | null> {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!session) return null;
  const user = await getUser(session.email).catch(() => null);
  if (!user || !user.passwordHash) return null;
  if (opts.admin && user.role !== 'admin') return null;
  if (opts.csrf !== false && !verifyCsrfHeader(req, session)) return null;
  return { session, user };
}
