// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import type { NextRequest } from 'next/server';
import { CSRF_COOKIE, PRE_COOKIE, csrfTokenFor, type SessionRecord } from './session';
import { safeEqual } from '@/server/security/crypto';

/**
 * Peticiones con sesión. Double Submit firmado: el token (cabecera X-CSRF-Token o campo de
 * formulario "csrf") debe coincidir con el HMAC derivado del secreto de la sesión.
 * Una cookie plantada por un tercero no sirve.
 */
export function verifyCsrfToken(token: string | null | undefined, session: SessionRecord): boolean {
  return Boolean(token) && safeEqual(token!, csrfTokenFor(session));
}

/** Para fetch desde el cliente: cabecera + cookie + HMAC. */
export function verifyCsrfHeader(req: NextRequest, session: SessionRecord): boolean {
  const header = req.headers.get('x-csrf-token') ?? '';
  const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? '';
  return header.length > 0 && safeEqual(header, cookie) && verifyCsrfToken(header, session);
}

/** Formularios sin sesión (login, activación): la cookie __Host-fo_pre debe coincidir con el campo oculto. */
export function verifyPreSessionCsrf(req: NextRequest, field: string | null | undefined): boolean {
  const cookie = req.cookies.get(PRE_COOKIE)?.value ?? '';
  return cookie.length >= 32 && Boolean(field) && safeEqual(cookie, field!);
}
