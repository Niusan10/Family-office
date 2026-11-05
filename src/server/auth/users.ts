import 'server-only';
import { redis } from '@/server/db/redis';
import { requireEnv } from '@/env';
import { randomToken, safeEqual, sha256 } from '@/server/security/crypto';

export type Role = 'admin' | 'miembro';

export type User = {
  email: string;
  role: Role;
  passwordHash: string | null; // null = autorizado pero aún sin contraseña (pendiente de activar)
  createdAt: number;
  createdBy: string;
  passwordSetAt: number | null;
};

const userKey = (email: string) => `fo:user:${email}`;
const USERS = 'fo:users';
const inviteKey = (hash: string) => `fo:invite:${hash}`;
const INVITE_TTL = 72 * 3600;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

/**
 * El administrador inicial (ADMIN_EMAIL) se crea automáticamente la primera vez, sin contraseña.
 * La contraseña se fija con el enlace de activación protegido por SETUP_TOKEN.
 */
async function ensureBootstrapAdmin(): Promise<void> {
  const email = requireEnv().ADMIN_EMAIL;
  const exists = await redis().exists(userKey(email));
  if (exists) return;
  const admin: User = { email, role: 'admin', passwordHash: null, createdAt: Date.now(), createdBy: 'sistema', passwordSetAt: null };
  await redis().pipeline().set(userKey(email), admin, { nx: true }).sadd(USERS, email).exec();
}

export async function getUser(email: string): Promise<User | null> {
  await ensureBootstrapAdmin();
  return redis().get<User>(userKey(normalizeEmail(email)));
}

export async function listUsers(): Promise<User[]> {
  await ensureBootstrapAdmin();
  const emails = await redis().smembers(USERS);
  if (emails.length === 0) return [];
  const users = await redis().mget<(User | null)[]>(...emails.map(userKey));
  return users.filter((u): u is User => Boolean(u)).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addUser(email: string, role: Role, createdBy: string): Promise<'ok' | 'exists'> {
  const e = normalizeEmail(email);
  const user: User = { email: e, role, passwordHash: null, createdAt: Date.now(), createdBy, passwordSetAt: null };
  const ok = await redis().set(userKey(e), user, { nx: true });
  if (ok !== 'OK') return 'exists';
  await redis().sadd(USERS, e);
  return 'ok';
}

export async function removeUser(email: string): Promise<void> {
  const e = normalizeEmail(email);
  await redis().pipeline().del(userKey(e)).srem(USERS, e).exec();
}

export async function setPassword(email: string, passwordHash: string): Promise<void> {
  const user = await getUser(email);
  if (!user) throw new Error('no_user');
  await redis().set(userKey(user.email), { ...user, passwordHash, passwordSetAt: Date.now() });
}

/** Enlace de un solo uso (72 h) para fijar o restablecer la contraseña. Solo se guarda su hash. */
export async function createInvite(email: string): Promise<string> {
  const token = randomToken(32);
  await redis().set(inviteKey(sha256(token)), normalizeEmail(email), { ex: INVITE_TTL });
  return token;
}

/** Resuelve un token sin consumirlo (para mostrar el formulario). */
export async function peekInvite(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const env = requireEnv();
  if (safeEqual(token, env.SETUP_TOKEN)) {
    const admin = await getUser(env.ADMIN_EMAIL);
    return admin && !admin.passwordHash ? admin.email : null; // el token de arranque solo sirve una vez
  }
  const email = await redis().get<string>(inviteKey(sha256(token)));
  if (!email) return null;
  return (await getUser(email)) ? email : null;
}

/** Consume el token: después de esto ya no sirve. */
export async function consumeInvite(token: string): Promise<string | null> {
  const email = await peekInvite(token);
  if (!email) return null;
  if (!safeEqual(token, requireEnv().SETUP_TOKEN)) await redis().del(inviteKey(sha256(token)));
  return email;
}
