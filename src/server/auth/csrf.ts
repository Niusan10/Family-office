// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import type { NextRequest } from 'next/server';
import { CSRF_COOKIE, csrfTokenFor, type SessionRecord } from './session';
import { safeEqual } from '@/server/security/crypto';

/**
 * Double Submit firmado: la cabecera X-CSRF-Token debe coincidir con la cookie y con el HMAC
 * derivado del secreto de la sesión. Una cookie plantada por un tercero no sirve.
 */
export function verifyCsrf(req: NextRequest, session: SessionRecord): boolean {
  const header = req.headers.get('x-csrf-token') ?? '';
  const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? '';
  const expected = csrfTokenFor(session);
  return header.length > 0 && safeEqual(header, cookie) && safeEqual(header, expected);
}
