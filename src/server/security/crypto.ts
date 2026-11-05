// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireEnv } from '@/env';

const key = () => {
  const k = Buffer.from(requireEnv().SEAL_KEY, 'base64');
  if (k.length !== 32) throw new Error('SEAL_KEY must be 32 bytes (base64)');
  return k;
};

/** Cifra y autentica (AES-256-GCM) un objeto con caducidad. Salida: base64url(iv | tag | ciphertext). */
export function seal(data: object, ttlSec: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = JSON.stringify({ d: data, exp: Math.floor(Date.now() / 1000) + ttlSec });
  const ct = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

/** Devuelve null si el valor falta, fue manipulado o ha caducado. */
export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(body) as { d: T; exp: number };
    if (parsed.exp < Date.now() / 1000) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
