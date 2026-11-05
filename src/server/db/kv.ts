// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
//
// Almacén clave-valor mínimo sobre Vercel Blob PRIVADO (store "fo-data", región fra1).
// Cada clave es un fichero JSON { v, exp } bajo el prefijo "fo/". Ningún fichero es accesible
// sin el token del proyecto. Las lecturas son consistentes (useCache: false).
import { del, get, list, put } from '@vercel/blob';
import { requireEnv } from '@/env';

type Envelope<T> = { v: T; exp: number | null };

const now = () => Math.floor(Date.now() / 1000);
const auth = () => ({ access: 'private' as const, token: requireEnv().BLOB_TOKEN });
const path = (key: string) => `fo/${key}.json`;
const keyOf = (pathname: string) => pathname.replace(/^fo\//, '').replace(/\.json$/, '');

async function readJson<T>(pathname: string): Promise<Envelope<T> | null> {
  const r = await get(pathname, { ...auth(), useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const stream = (r as unknown as { stream?: ReadableStream }).stream;
  if (!stream) return null;
  return JSON.parse(await new Response(stream).text()) as Envelope<T>;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const env = await readJson<T>(path(key));
  if (!env) return null;
  if (env.exp !== null && env.exp < now()) {
    await kvDel(key).catch(() => undefined);
    return null;
  }
  return env.v;
}

/** Guarda un valor. Con nx solo escribe si la clave no existe (o ha caducado). Devuelve si escribió. */
export async function kvSet<T>(key: string, value: T, opts: { ttl?: number; nx?: boolean } = {}): Promise<boolean> {
  if (opts.nx && (await kvGet(key)) !== null) return false;
  const body: Envelope<T> = { v: value, exp: opts.ttl ? now() + opts.ttl : null };
  await put(path(key), JSON.stringify(body), {
    ...auth(),
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return true;
}

export async function kvDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await del(keys.map(path), { token: requireEnv().BLOB_TOKEN });
}

/** Claves que empiezan por un prefijo (sin el "fo/" ni el ".json"). */
export async function kvKeys(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `fo/${prefix}`, cursor, limit: 1000, token: requireEnv().BLOB_TOKEN });
    out.push(...page.blobs.map((b) => keyOf(b.pathname)));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Contador con caducidad (no atómico: suficiente para límites de intentos con poco tráfico). */
export async function kvIncr(key: string, ttl: number): Promise<number> {
  const n = ((await kvGet<number>(key)) ?? 0) + 1;
  await kvSet(key, n, { ttl });
  return n;
}
