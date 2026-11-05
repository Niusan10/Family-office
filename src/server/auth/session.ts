// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { createHmac } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { kvDel, kvGet, kvKeys, kvSet } from '@/server/db/kv';
import { randomToken, sha256 } from '@/server/security/crypto';
import { audit } from '@/server/security/audit';

export const SESSION_COOKIE = '__Host-fo_sid';
export const CSRF_COOKIE = '__Host-fo_csrf';
export const PRE_COOKIE = '__Host-fo_pre'; // anti-CSRF de formularios sin sesión (login, activación)

const IDLE = 30 * 60; //        30 min de inactividad
const ABSOLUTE = 8 * 3600; //   8 h máximo desde el login
const ROTATE = 5 * 60; //       rotación del identificador
const GRACE = 30; //            tolerancia para peticiones paralelas tras rotar
const TOUCH = 60; //            como mucho una escritura por minuto para renovar la inactividad

export type SessionRecord = {
  email: string;
  family: string;
  createdAt: number;
  rotatedAt: number;
  lastSeen: number;
  csrfSecret: string;
  uaHash: string;
};

type RotatedRecord = { rotatedTo: string; graceUntil: number };

const now = () => Math.floor(Date.now() / 1000);

// La cookie es "<familia>.<secreto>". Solo se guarda el hash del secreto: un volcado no da sesiones válidas.
const parseSid = (sid: string) => {
  const [family, secret] = sid.split('.');
  return family && secret && /^[\w-]{16,64}$/.test(family) ? { family, secret } : null;
};
const sessKey = (family: string, secretHash: string) => `sess/${family}/${secretHash}`;
const userSessKey = (email: string, family: string) => `usersess/${sha256(email)}/${family}`;

export async function createSession(email: string, ua: string) {
  const family = randomToken(16);
  const secret = randomToken(32);
  const t = now();
  const record: SessionRecord = {
    email,
    family,
    createdAt: t,
    rotatedAt: t,
    lastSeen: t,
    csrfSecret: randomToken(32),
    uaHash: sha256(ua),
  };
  await Promise.all([
    kvSet(sessKey(family, sha256(secret)), record, { ttl: IDLE }),
    kvSet(userSessKey(email, family), 1, { ttl: ABSOLUTE + IDLE }),
  ]);
  return { sid: `${family}.${secret}`, session: record };
}

export type SessionCheck = { session: SessionRecord; rotatedSid: string | null };

/**
 * Valida la sesión, renueva la inactividad y rota el secreto cada 5 minutos.
 * Un secreto ya rotado que vuelve fuera de la gracia revoca toda la familia.
 */
export async function validateAndTouchSession(sid: string, ua: string): Promise<SessionCheck | null> {
  const p = parseSid(sid);
  if (!p) return null;
  const key = sessKey(p.family, sha256(p.secret));
  const s = await kvGet<SessionRecord | RotatedRecord>(key);
  if (!s) return null;
  const t = now();

  if ('rotatedTo' in s) {
    if (t <= s.graceUntil) {
      const current = await kvGet<SessionRecord>(sessKey(p.family, s.rotatedTo));
      return current ? { session: current, rotatedSid: null } : null;
    }
    await revokeFamily(p.family);
    await audit({ event: 'session.reuse_detected' });
    return null;
  }

  if (t - s.createdAt > ABSOLUTE || s.uaHash !== sha256(ua)) {
    await revokeFamily(p.family);
    await audit({ event: 'session.invalid', email: s.email, reason: t - s.createdAt > ABSOLUTE ? 'absolute' : 'ua' });
    return null;
  }

  if (t - s.rotatedAt > ROTATE) {
    const next = randomToken(32);
    const nextHash = sha256(next);
    await kvSet(sessKey(p.family, nextHash), { ...s, rotatedAt: t, lastSeen: t }, { ttl: IDLE });
    await kvSet<RotatedRecord>(key, { rotatedTo: nextHash, graceUntil: t + GRACE }, { ttl: GRACE + 5 });
    return { session: s, rotatedSid: `${p.family}.${next}` };
  }

  if (t - s.lastSeen > TOUCH) await kvSet(key, { ...s, lastSeen: t }, { ttl: IDLE });
  return { session: s, rotatedSid: null };
}

/** Lectura sin efectos (Server Components y route handlers): sigue una rotación en curso. */
export async function readSession(sid: string | undefined): Promise<SessionRecord | null> {
  const p = sid ? parseSid(sid) : null;
  if (!p) return null;
  const s = await kvGet<SessionRecord | RotatedRecord>(sessKey(p.family, sha256(p.secret)));
  if (!s) return null;
  if ('rotatedTo' in s) return kvGet<SessionRecord>(sessKey(p.family, s.rotatedTo));
  return s;
}

export async function revokeFamily(family: string): Promise<void> {
  await kvDel(...(await kvKeys(`sess/${family}/`)));
}

/** Cierra todas las sesiones de un usuario (al quitarle el acceso o cambiar su contraseña). */
export async function revokeAllForUser(email: string): Promise<void> {
  const markers = await kvKeys(`usersess/${sha256(email)}/`);
  for (const m of markers) await revokeFamily(m.split('/').at(-1)!);
  await kvDel(...markers);
}

export const csrfTokenFor = (s: SessionRecord) =>
  createHmac('sha256', s.csrfSecret).update('csrf').digest('base64url');

/** Cookies de sesión: __Host- exige Secure, Path=/ y sin Domain. */
export function setSessionCookies(res: NextResponse, sid: string, session: SessionRecord) {
  res.cookies.set({ name: SESSION_COOKIE, value: sid, httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  res.cookies.set({ name: CSRF_COOKIE, value: csrfTokenFor(session), httpOnly: false, secure: true, sameSite: 'strict', path: '/' });
}

/** Borrado explícito: un __Host- cookie solo se borra si el Set-Cookie lleva Secure y Path=/. */
export function clearCookie(res: NextResponse, name: string) {
  res.cookies.set({ name, value: '', maxAge: 0, httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}
