import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, SESSION_COOKIE, type SessionRecord } from './session';
import { getEnv } from '@/env';

/**
 * Segunda barrera, independiente del proxy: todo layout, página, Server Action o route handler
 * privado la llama. Si no hay sesión válida, redirige a /login sin renderizar nada.
 */
export async function requireSession(): Promise<SessionRecord> {
  if (!getEnv()) redirect('/login');
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(sid).catch(() => null);
  if (!session) redirect('/login');
  return session;
}
