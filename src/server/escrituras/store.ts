import 'server-only';
import { deletePrefix, kvGet, kvKeys, kvSet, rawGet, rawPut } from '@/server/db/kv';
import { COMPANIES } from '@/server/holding/companies';

/**
 * Escrituras de las sociedades. Todo vive en el almacén privado bajo fo/escrituras/<id>/:
 * - meta.json           ficha y estado
 * - part-NNN.bin        el PDF original, en trozos de 4 MB (límite de subida de Vercel)
 * - chunk-NNN.pdf       el PDF troceado en grupos de páginas para transcribirlo
 * - pages-NNN.json      texto literal de cada página de ese grupo
 */
export const PART_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_BYTES = 80 * 1024 * 1024;
export const CHUNK_PAGES = 4;

export type EscrituraStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type EscrituraIndex = {
  tipo: string | null;
  fecha: string | null;
  notario: string | null;
  protocolo: string | null;
  sociedades: string[];
  resumen: string | null;
};

export type EscrituraMeta = {
  id: string;
  title: string;
  /** Slug de la empresa (COMPANIES) o "holding" / "otras". */
  company: string;
  fileName: string;
  size: number;
  parts: number;
  status: EscrituraStatus;
  pages: number | null;
  chunks: number | null;
  chunksDone: number;
  error: string | null;
  index: EscrituraIndex | null;
  uploadedBy: string;
  uploadedAt: number;
};

export const COMPANY_OPTIONS: { slug: string; name: string; color: string }[] = [
  ...COMPANIES.map((c) => ({ slug: c.slug, name: c.name, color: c.color })),
  { slug: 'holding', name: 'Family office / holding', color: '#424242' },
  { slug: 'otras', name: 'Otras', color: '#b5b5b5' },
];
export const companyName = (slug: string) => COMPANY_OPTIONS.find((c) => c.slug === slug)?.name ?? slug;

export const ID_RE = /^e[a-z0-9]{10,24}$/;
const n3 = (n: number) => String(n).padStart(3, '0');
const base = (id: string) => `escrituras/${id}`;

export const metaKey = (id: string) => `${base(id)}/meta`;
export const getMeta = (id: string) => (ID_RE.test(id) ? kvGet<EscrituraMeta>(metaKey(id)) : Promise.resolve(null));
export const saveMeta = (m: EscrituraMeta) => kvSet(metaKey(m.id), m);

export async function listMetas(): Promise<EscrituraMeta[]> {
  const keys = (await kvKeys('escrituras/')).filter((k) => /^escrituras\/[a-z0-9]+\/meta$/.test(k));
  const metas = await Promise.all(keys.map((k) => kvGet<EscrituraMeta>(k)));
  return metas
    .filter((m): m is EscrituraMeta => m !== null)
    .sort((a, b) => (b.index?.fecha ?? '').localeCompare(a.index?.fecha ?? '') || b.uploadedAt - a.uploadedAt);
}

export const putPart = (id: string, n: number, data: Buffer) => rawPut(`${base(id)}/part-${n3(n)}.bin`, data);

export async function readOriginal(meta: EscrituraMeta): Promise<Buffer | null> {
  const parts: Buffer[] = [];
  for (let i = 0; i < meta.parts; i++) {
    const p = await rawGet(`${base(meta.id)}/part-${n3(i)}.bin`);
    if (!p) return null;
    parts.push(p);
  }
  return Buffer.concat(parts);
}

export const putChunk = (id: string, n: number, pdf: Buffer) => rawPut(`${base(id)}/chunk-${n3(n)}.pdf`, pdf, 'application/pdf');
export const getChunk = (id: string, n: number) => rawGet(`${base(id)}/chunk-${n3(n)}.pdf`);

export const putPages = (id: string, n: number, pages: string[]) => kvSet(`${base(id)}/pages-${n3(n)}`, pages);

/** Texto de todas las páginas, en orden (la posición 0 es la página 1). */
export async function getAllPages(meta: EscrituraMeta): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < (meta.chunks ?? 0); i++) {
    const pages = (await kvGet<string[]>(`${base(meta.id)}/pages-${n3(i)}`)) ?? [];
    out.push(...pages);
  }
  return out;
}

export const deleteEscritura = (id: string) => (ID_RE.test(id) ? deletePrefix(`${base(id)}/`) : Promise.resolve());
