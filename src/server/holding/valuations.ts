import 'server-only';
import { kvGet, kvSet } from '@/server/db/kv';
import { COMPANIES } from './companies';

/**
 * Valoración vigente de cada empresa, en euros.
 * - equity: equity value (valor de los fondos propios)
 * - ev: enterprise value (equity + deuda financiera neta)
 *
 * Hoy se introduce a mano desde Admin › Valoraciones. Más adelante se calculará a partir de los
 * balances y cuentas de resultados de cada cierre mensual y del método de valoración elegido;
 * por eso cada valoración guarda su fecha y su origen.
 */
export type CompanyValuation = { equity: number | null; ev: number | null };

export type Valuations = {
  bySlug: Record<string, CompanyValuation>;
  /** Fecha a la que se refiere la valoración (AAAA-MM-DD). */
  asOf: string | null;
  source: 'manual';
  updatedAt: number;
  updatedBy: string;
};

const KEY = 'holding/valuations';

export async function getValuations(): Promise<Valuations | null> {
  return kvGet<Valuations>(KEY);
}

export async function saveValuations(v: Omit<Valuations, 'updatedAt' | 'source'>): Promise<void> {
  const known = new Set(COMPANIES.map((c) => c.slug));
  const bySlug = Object.fromEntries(Object.entries(v.bySlug).filter(([slug]) => known.has(slug)));
  await kvSet<Valuations>(KEY, { ...v, bySlug, source: 'manual', updatedAt: Date.now() });
}

/**
 * Convierte el texto de un campo en euros. Acepta formato español ("1.250.000", "1.250.000,50",
 * "1,5M", "800k") y deja el campo vacío como null. Devuelve undefined si no es un importe válido.
 */
export function parseEuros(raw: string): number | null | undefined {
  let s = raw.trim().replace(/\s|€/g, '').toLowerCase();
  if (s === '') return null;
  let mult = 1;
  if (s.endsWith('m')) { mult = 1e6; s = s.slice(0, -1); }
  else if (s.endsWith('k')) { mult = 1e3; s = s.slice(0, -1); }
  // Formato español: el punto separa miles y la coma es el decimal.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Math.round(Number(s) * mult);
  return Number.isFinite(n) && Math.abs(n) < 1e13 ? n : undefined;
}
