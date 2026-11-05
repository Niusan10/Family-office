import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt (memory-hard). N=2^15, r=8, p=1 → ~32 MB y ~100 ms por intento: caro para fuerza bruta.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** Formato: scrypt$N$r$p$salt$hash (base64url) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Hash ficticio para gastar el mismo tiempo cuando el email no existe (evita enumerar usuarios por tiempo).
let dummy: Promise<string> | null = null;
export async function burnTime(password: string): Promise<void> {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(password, await dummy);
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (pw.length > PASSWORD_MAX) return 'La contraseña es demasiado larga.';
  return null;
}
