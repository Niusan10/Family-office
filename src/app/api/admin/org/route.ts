import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/server/auth/session';
import { verifyCsrfToken } from '@/server/auth/csrf';
import { getUser } from '@/server/auth/users';
import { kvSet } from '@/server/db/kv';
import { getOrg, parsePct, ROOT_ID, saveOrg, validateOrg, type OrgEntity, type OrgKind } from '@/server/holding/org';
import { audit } from '@/server/security/audit';
import { randomToken } from '@/server/security/crypto';
import { clientIp } from '@/server/security/rate-limit';
import type { Flash } from '@/server/ui/flash';

export const dynamic = 'force-dynamic';

const NEW_ROWS = 3;
const clean = (v: FormDataEntryValue | null) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const kindOf = (v: FormDataEntryValue | null): OrgKind => (String(v) === 'other' ? 'other' : 'holding');

/** Guarda el organigrama. Solo administradores, con sesión, Origin (proxy) y token CSRF. */
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const actor = session ? await getUser(session.email) : null;
  const form = await req.formData().catch(() => null);
  if (!session || !actor || actor.role !== 'admin' || !form || !verifyCsrfToken(String(form.get('csrf') ?? ''), session)) {
    return new NextResponse(null, { status: 404 });
  }

  const current = await getOrg();
  const errors: string[] = [];
  const next: OrgEntity[] = [];
  const removed = new Set<string>();

  for (const e of current.entities) {
    if (e.id === ROOT_ID) {
      next.push({ ...e, name: clean(form.get(`name.${e.id}`)) || e.name });
      continue;
    }
    const isCompany = e.kind === 'company';
    if (!isCompany && form.get(`del.${e.id}`) === '1') {
      removed.add(e.id);
      continue;
    }
    const pct = parsePct(String(form.get(`pct.${e.id}`) ?? ''));
    if (pct === undefined) errors.push(`porcentaje de ${e.name}`);
    next.push({
      id: e.id,
      kind: isCompany ? 'company' : kindOf(form.get(`kind.${e.id}`)),
      name: isCompany ? e.name : clean(form.get(`name.${e.id}`)) || e.name,
      parentId: String(form.get(`parent.${e.id}`) ?? ROOT_ID),
      pct: pct ?? null,
    });
  }

  for (let i = 0; i < NEW_ROWS; i++) {
    const name = clean(form.get(`name.new${i}`));
    if (!name) continue;
    const pct = parsePct(String(form.get(`pct.new${i}`) ?? ''));
    if (pct === undefined) errors.push(`porcentaje de ${name}`);
    next.push({
      id: `s-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`,
      kind: kindOf(form.get(`kind.new${i}`)),
      name,
      parentId: String(form.get(`parent.new${i}`) ?? ROOT_ID),
      pct: pct ?? null,
    });
  }

  // Lo que dependía de una sociedad quitada pasa a depender de la sociedad de la que dependía ella.
  const oldParent = new Map(current.entities.map((e) => [e.id, e.parentId]));
  for (const e of next) {
    let p = e.parentId;
    while (p && removed.has(p)) p = oldParent.get(p) ?? ROOT_ID;
    e.parentId = e.id === ROOT_ID ? null : p ?? ROOT_ID;
  }

  let flash: Flash;
  const invalid = errors.length ? null : validateOrg(next);
  if (errors.length) {
    flash = { kind: 'err', text: `No se ha guardado nada. Revisa: ${errors.join(', ')} (entre 0 y 100).` };
  } else if (invalid) {
    flash = { kind: 'err', text: `No se ha guardado nada. ${invalid}` };
  } else {
    await saveOrg(next, actor.email);
    await audit({ event: 'org.updated', by: actor.email, ip: clientIp(req) });
    flash = { kind: 'ok', text: 'Organigrama guardado.' };
  }

  await kvSet(`flash/${session.family}`, flash, { ttl: 600 });
  return NextResponse.redirect(new URL('/admin/organigrama', req.url), 303);
}
