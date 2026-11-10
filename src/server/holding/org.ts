import 'server-only';
import { kvGet, kvSet } from '@/server/db/kv';
import { COMPANIES } from './companies';

/**
 * Organigrama societario del holding: quién participa en quién y con qué porcentaje.
 *
 * - En la cima está el family office (la raíz, sin padre).
 * - Las empresas operativas (las de COMPANIES) siempre están; solo se elige de quién dependen y su %.
 * - Se pueden añadir sociedades intermedias (holdings) u otras participadas.
 *
 * Se edita a mano en Admin › Organigrama y se guarda en fo/holding/org.json.
 */
export type OrgKind = 'top' | 'holding' | 'company' | 'other';

export type OrgEntity = {
  id: string;
  name: string;
  kind: OrgKind;
  /** De quién depende. Solo la raíz no tiene padre. */
  parentId: string | null;
  /** Porcentaje que el padre tiene en esta sociedad (0–100). null = sin definir. */
  pct: number | null;
};

export type OrgChart = { entities: OrgEntity[]; updatedAt: number | null; updatedBy: string | null };

export type OrgNode = OrgEntity & {
  color: string | null;
  /** Participación efectiva del family office (producto de los % del camino). null si falta algún %. */
  effective: number | null;
  children: OrgNode[];
};

export const ROOT_ID = 'family-office';
export const KIND_LABEL: Record<OrgKind, string> = {
  top: 'Family office',
  holding: 'Sociedad holding',
  company: 'Empresa operativa',
  other: 'Otra participada',
};

const ORG_DOC = 'holding/org';
const COMPANY_IDS = new Set(COMPANIES.map((c) => c.slug));
export const MAX_ENTITIES = 60;

/**
 * Lee el organigrama y lo deja siempre coherente: raíz presente, todas las empresas presentes con su
 * nombre oficial y ningún padre que no exista (lo que quede colgando pasa a depender de la raíz).
 */
export async function getOrg(): Promise<OrgChart> {
  const saved = await kvGet<OrgChart>(ORG_DOC);
  return { ...normalize(saved?.entities ?? []), updatedAt: saved?.updatedAt ?? null, updatedBy: saved?.updatedBy ?? null };
}

function normalize(input: OrgEntity[]): { entities: OrgEntity[] } {
  const byId = new Map<string, OrgEntity>();
  for (const e of input) {
    if (e.id === ROOT_ID || COMPANY_IDS.has(e.id)) continue;
    if (e.kind === 'holding' || e.kind === 'other') byId.set(e.id, { ...e });
  }
  const savedRoot = input.find((e) => e.id === ROOT_ID);
  const root: OrgEntity = { id: ROOT_ID, name: savedRoot?.name || 'Family office', kind: 'top', parentId: null, pct: null };

  const companies: OrgEntity[] = COMPANIES.map((c) => {
    const s = input.find((e) => e.id === c.slug);
    return { id: c.slug, name: c.name, kind: 'company', parentId: s?.parentId ?? ROOT_ID, pct: s?.pct ?? null };
  });

  const entities = [root, ...byId.values(), ...companies];
  const ids = new Set(entities.map((e) => e.id));
  for (const e of entities) {
    if (e.id === ROOT_ID) continue;
    if (!e.parentId || !ids.has(e.parentId) || e.parentId === e.id) e.parentId = ROOT_ID;
  }
  // Un ciclo (que no debería poder guardarse) se rompe colgando de la raíz.
  for (const e of entities) if (e.id !== ROOT_ID && hasCycle(entities, e.id)) e.parentId = ROOT_ID;
  return { entities };
}

function hasCycle(entities: OrgEntity[], startId: string): boolean {
  const parent = new Map(entities.map((e) => [e.id, e.parentId]));
  const seen = new Set<string>();
  let cur: string | null | undefined = startId;
  while (cur) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = parent.get(cur);
  }
  return false;
}

/** Comprueba la estructura antes de guardarla. Devuelve el motivo si no es válida. */
export function validateOrg(entities: OrgEntity[]): string | null {
  if (entities.length > MAX_ENTITIES) return `Como máximo ${MAX_ENTITIES} sociedades.`;
  const ids = new Set(entities.map((e) => e.id));
  const names = new Map(entities.map((e) => [e.id, e.name]));
  for (const e of entities) {
    if (e.id === ROOT_ID) continue;
    if (!e.parentId || !ids.has(e.parentId)) return `${e.name}: la sociedad de la que depende no existe.`;
    if (e.parentId === e.id) return `${e.name} no puede depender de sí misma.`;
    if (hasCycle(entities, e.id)) return `${e.name} y ${names.get(e.parentId)} dependen la una de la otra.`;
  }
  return null;
}

/** "100", "51,5", "51.5 %" → número; vacío → null; inválido → undefined. */
export function parsePct(raw: string): number | null | undefined {
  const s = raw.trim().replace(/\s|%/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : undefined;
}

export async function saveOrg(entities: OrgEntity[], by: string): Promise<void> {
  await kvSet<OrgChart>(ORG_DOC, { entities, updatedAt: Date.now(), updatedBy: by });
}

/** Árbol para pintar, con el color de cada empresa y la participación efectiva desde la raíz. */
export function buildTree(org: OrgChart): OrgNode {
  const color = new Map(COMPANIES.map((c) => [c.slug, c.color]));
  const kids = new Map<string, OrgEntity[]>();
  for (const e of org.entities) {
    if (e.parentId) kids.set(e.parentId, [...(kids.get(e.parentId) ?? []), e]);
  }
  const order: Record<OrgKind, number> = { top: 0, holding: 1, other: 2, company: 3 };

  const make = (e: OrgEntity, parentEffective: number | null): OrgNode => {
    const effective = e.id === ROOT_ID ? 100 : parentEffective === null || e.pct === null ? null : (parentEffective * e.pct) / 100;
    const children = [...(kids.get(e.id) ?? [])]
      .sort((a, b) => order[a.kind] - order[b.kind])
      .map((c) => make(c, effective));
    return { ...e, color: color.get(e.id) ?? null, effective, children };
  };

  return make(org.entities.find((e) => e.id === ROOT_ID)!, 100);
}

/** 100 → "100 %", 51.5 → "51,5 %". */
export const pctText = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;
