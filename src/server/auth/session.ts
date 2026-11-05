// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { createHmac } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { redis } from '@/server/db/redis';
import { randomToken, sha256 } from '@/server/security/crypto';
import { audit } from '@/server/security/audit';

export const SESSION_COOKIE = '__Host-fo_sid';
export const CSRF_COOKIE = '__Host-fo_csrf';
export const OAUTH_COOKIE = '__Host-fo_oauth';

const IDLE = 15 * 60; //        inactividad máxima
const ABSOLUTE = 8 * 3600; //   vida máxima desde el login
const ROTATE = 5 * 60; //       rotación del identificador
const GRACE = 30; //            tolerancia para peticiones paralelas tras rotar

export type SessionRecord = {
  email: string;
  sub: string;
  family: string;
  createdAt: number;
  rotatedAt: number;
  csrfSecret: string;
  uaHash: string;
};

type RotatedRecord = { rotatedTo: string; graceUntil: number; family: string };

const now = () => Math.floor(Date.now() / 1000);
const sessKey = (hash: string) => `sess:${hash}`;
const famKey = (family: string) => `fam:${family}`;

export async function createSession(user: { email: string; sub: string }, ua: string) {
  const sid = randomToken(32);
  const hash = sha256(sid);
  const t = now();
  const record: SessionRecord = {
    email: user.email,
    sub: user.sub,
    family: randomToken(16),
    createdAt: t,
    rotatedAt: t,
    csrfSecret: randomToken(32),
    uaHash: sha256(ua),
  };
  await redis()
    .pipeline()
    .set(sessKey(hash), record, { ex: IDLE })
    .sadd(famKey(record.family), hash)
    .expire(famKey(record.family), ABSOLUTE + IDLE)
    .exec();
  return { sid, session: record };
}

export type SessionCheck = { session: SessionRecord; rotatedSid: string | null };

/**
 * Valida la sesión, renueva la inactividad y rota el identificador cada 5 minutos.
 * Un identificador ya rotado que vuelve fuera de la gracia revoca toda la familia.
 */
export async function validateAndTouchSession(sid: string, ua: string): Promise<SessionCheck | null> {
  const key = sessKey(sha256(sid));
  const s = await redis().get<SessionRecord | RotatedRecord>(key);
  if (!s) return null;
  const t = now();

  if ('rotatedTo' in s) {
    if (t <= s.graceUntil) {
      const current = await redis().get<SessionRecord>(sessKey(s.rotatedTo));
      return current ? { session: current, rotatedSid: null } : null;
    }
    await revokeFamily(s.family);
    await audit({ event: 'session.reuse_detected' });
    return null;
  }

  if (t - s.createdAt > ABSOLUTE || s.uaHash !== sha256(ua)) {
    await revokeFamily(s.family);
    await audit({ event: 'session.invalid', email: s.email, reason: t - s.createdAt > ABSOLUTE ? 'absolute' : 'ua' });
    return null;
  }

  if (t - s.rotatedAt > ROTATE) {
    const next = randomToken(32);
    const nextHash = sha256(next);
    const rotated: RotatedRecord = { rotatedTo: nextHash, graceUntil: t + GRACE, family: s.family };
    await redis()
      .pipeline()
      .set(sessKey(nextHash), { ...s, rotatedAt: t }, { ex: IDLE })
      .set(key, rotated, { ex: IDLE })
      .sadd(famKey(s.family), nextHash)
      .exec();
    return { session: s, rotatedSid: next };
  }

  await redis().expire(key, IDLE);
  return { session: s, rotatedSid: null };
}

/** Lectura sin efectos (para Server Components): sigue una rotación en curso, no rota ni revoca. */
export async function readSession(sid: string | undefined): Promise<SessionRecord | null> {
  if (!sid) return null;
  const s = await redis().get<SessionRecord | RotatedRecord>(sessKey(sha256(sid)));
  if (!s) return null;
  if ('rotatedTo' in s) return redis().get<SessionRecord>(sessKey(s.rotatedTo));
  return s;
}

export async function revokeFamily(family: string): Promise<void> {
  const r = redis();
  const hashes = await r.smembers(famKey(family));
  const p = r.pipeline();
  for (const h of hashes) p.del(sessKey(h));
  p.del(famKey(family));
  await p.exec();
}

export const csrfTokenFor = (s: SessionRecord) =>
  createHmac('sha256', s.csrfSecret).update('csrf').digest('base64url');

/** Cookies de sesión: __Host- exige Secure, Path=/ y sin Domain. */
export function setSessionCookies(res: NextResponse, sid: string, session: SessionRecord) {
  res.cookies.set({ name: SESSION_COOKIE, value: sid, httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  res.cookies.set({ name: CSRF_COOKIE, value: csrfTokenFor(session), httpOnly: false, secure: true, sameSite: 'strict', path: '/' });
}

/** Borrado explícito: un __Host- cookie solo se borra si el Set-Cookie lleva Secure y Path=/. */
export function clearCookie(res: NextResponse, name: string, sameSite: 'strict' | 'lax' = 'strict') {
  res.cookies.set({ name, value: '', maxAge: 0, httpOnly: true, secure: true, sameSite, path: '/' });
}
