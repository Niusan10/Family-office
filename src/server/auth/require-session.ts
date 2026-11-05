import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { readSession, SESSION_COOKIE, type SessionRecord } from './session';
import { getUser, type User } from './users';
import { getEnv } from '@/env';

/**
 * Segunda barrera, independiente del proxy: todo layout, página o route handler privado la llama.
 * Comprueba la sesión y que el usuario siga autorizado. Si no, redirige a /login sin renderizar nada.
 */
export async function requireSession(): Promise<{ session: SessionRecord; user: User }> {
  if (!getEnv()) redirect('/login');
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(sid).catch(() => null);
  if (!session) redirect('/login');
  const user = await getUser(session.email).catch(() => null);
  if (!user || !user.passwordHash) redirect('/login');
  return { session, user };
}

/** Solo administradores. A un miembro se le responde como si la página no existiera. */
export async function requireAdmin() {
  const ctx = await requireSession();
  if (ctx.user.role !== 'admin') notFound();
  return ctx;
}
